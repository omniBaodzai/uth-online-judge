#!/usr/bin/env python3
"""Generate reviewable API test case proposals without executing any requests."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

try:
    from .generate_api_inventory import COLUMNS as API_INVENTORY_COLUMNS
except ImportError:
    from generate_api_inventory import COLUMNS as API_INVENTORY_COLUMNS


COLUMNS = [
    "Test Case ID",
    "Requirement ID",
    "API ID",
    "Module",
    "HTTP Method",
    "Endpoint",
    "Test Case Title",
    "Test Scenario",
    "Test Type",
    "Priority",
    "Preconditions",
    "Test Steps",
    "Test Data Reference",
    "Expected HTTP Status",
    "Expected Response",
    "Expected Database Effect",
    "Postconditions",
    "Automation Status",
    "Created By",
    "Created Date",
    "Review Status",
    "Notes",
]
REVIEW_COLUMNS = [*COLUMNS, "Review Reason"]
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
TEST_TYPES = {
    "Kiểm thử tích cực",
    "Kiểm thử tiêu cực",
    "Kiểm thử giá trị biên",
    "Kiểm thử phân quyền",
    "Kiểm thử xác thực",
    "Kiểm thử hợp lệ dữ liệu",
    "Kiểm thử tích hợp",
    "Kiểm thử bảo mật",
    "Kiểm thử hồi quy",
    "Kiểm thử hiệu năng",
}
PRIORITIES = {"Khẩn cấp", "Cao", "Trung bình", "Thấp"}
AUTOMATION_STATUSES = {"Thủ công", "Đã lên kế hoạch", "Đã tự động hóa"}
REVIEW_STATUSES = {"Bản nháp", "Đang duyệt", "Đã duyệt"}
API_ID_PATTERN = re.compile(r"^API-[A-Z0-9-]+-\d+$")
CASE_ID_PATTERN = re.compile(r"^TC-[A-Z0-9-]+-(\d+)$")
OPERATION_ID_PATTERN = re.compile(r"^([A-Za-z][A-Za-z0-9]*)_(.+)$")
DTO_CLASS_PATTERN = re.compile(r"^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)")
DTO_PROPERTY_PATTERN = re.compile(r"^\s{2}(?:readonly\s+)?([A-Za-z_$][\w$]*)([?!])?\s*:")
DECORATOR_PATTERN = re.compile(r"^\s{2}@([A-Za-z_$][\w$]*)")
CONTROLLER_CLASS_PATTERN = re.compile(r"^\s*export\s+class\s+([A-Za-z_$][\w$]*)")
METHOD_DECLARATION_PATTERN = re.compile(
    r"^\s{2}(?:(?:public|private|protected)\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\("
)
SUCCESS_STATUS_PATTERN = re.compile(r"^2\d\d$")
VALIDATION_CODES = {
    "MinLength": "minLength",
    "MaxLength": "maxLength",
    "Min": "minimum",
    "Max": "maximum",
    "Length": "length",
    "ArrayMinSize": "minItems",
    "ArrayMaxSize": "maxItems",
}
REVIEW_COMPARISON_FIELDS = (
    "API ID",
    "HTTP Method",
    "Endpoint",
    "Test Scenario",
    "Test Type",
    "Preconditions",
    "Test Steps",
    "Test Data Reference",
    "Expected HTTP Status",
    "Expected Response",
    "Expected Database Effect",
    "Postconditions",
)


@dataclass(frozen=True)
class Evidence:
    source: str
    location: str
    detail: str

    def as_dict(self) -> dict[str, str]:
        return {"source": self.source, "location": self.location, "detail": self.detail}


@dataclass
class DtoProperty:
    optional: bool = False
    constraints: dict[str, Any] = field(default_factory=dict)
    validators: set[str] = field(default_factory=set)
    evidence: list[Evidence] = field(default_factory=list)


@dataclass(frozen=True)
class ControllerRoute:
    source: str
    method_location: str
    guards: frozenset[str]
    guard_evidence: tuple[Evidence, ...]


@dataclass
class Candidate:
    api_id: str
    scenario_key: str
    id_prefix: str
    row: dict[str, str]
    evidence: list[Evidence]
    review_reasons: list[str]


class BackendIndex:
    """Index explicit DTO decorators and controller guards as source evidence."""

    def __init__(self, backend_root: Path, project_root: Path) -> None:
        self.backend_root = backend_root
        self.project_root = project_root
        self.dto_classes: dict[str, dict[str, DtoProperty]] = {}
        self.dto_sources: dict[str, str] = {}
        self.controllers: dict[str, tuple[Path, list[str], int]] = {}
        self.validation_evidence: list[Evidence] = []
        self.jwt_evidence: list[Evidence] = []
        self.admin_role_evidence: list[Evidence] = []
        self._index_backend()

    def _relative(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.project_root.resolve()).as_posix()
        except ValueError:
            return path.as_posix()

    def _index_backend(self) -> None:
        if not self.backend_root.is_dir():
            return
        for path in sorted(self.backend_root.rglob("*.dto.ts")):
            self._index_dto(path)
        for path in sorted(self.backend_root.rglob("*.controller.ts")):
            self._index_controller(path)

        main_file = self.backend_root / "src" / "main.ts"
        if main_file.is_file():
            lines = main_file.read_text(encoding="utf-8").splitlines()
            for index, line in enumerate(lines):
                if "new ValidationPipe(" in line:
                    self.validation_evidence.append(
                        Evidence(
                            self._relative(main_file),
                            f"lines {index + 1}-{min(index + 6, len(lines))}",
                            "Global NestJS ValidationPipe configuration.",
                        )
                    )
                    break

        for path in sorted(self.backend_root.rglob("*.ts")):
            if path.name.endswith(".spec.ts"):
                continue
            lines = path.read_text(encoding="utf-8").splitlines()
            for index, line in enumerate(lines):
                if "class JwtAuthGuard" in line:
                    self.jwt_evidence.append(
                        Evidence(
                            self._relative(path),
                            f"lines {index + 1}-{min(index + 1, len(lines))}",
                            "JWT guard delegates authentication to Passport's jwt strategy.",
                        )
                    )
                if "class AdminRoleGuard" in line:
                    self.admin_role_evidence.append(
                        Evidence(
                            self._relative(path),
                            f"lines {index + 1}-{min(index + 7, len(lines))}",
                            "AdminRoleGuard rejects non-ADMIN roles with ForbiddenException.",
                        )
                    )

    def _index_dto(self, path: Path) -> None:
        lines = path.read_text(encoding="utf-8").splitlines()
        class_name: str | None = None
        properties: dict[str, DtoProperty] = {}
        pending: list[tuple[str, int, str]] = []

        for index, line in enumerate(lines):
            class_match = DTO_CLASS_PATTERN.match(line)
            if class_match:
                if class_name:
                    self.dto_classes[class_name] = properties
                    self.dto_sources[class_name] = self._relative(path)
                class_name = class_match.group(1)
                properties = {}
                pending = []
                continue

            decorator_match = DECORATOR_PATTERN.match(line)
            if decorator_match:
                pending.append((decorator_match.group(1), index + 1, line.strip()))
                continue

            property_match = DTO_PROPERTY_PATTERN.match(line)
            if not property_match or class_name is None:
                continue
            name, marker = property_match.groups()
            item = DtoProperty(optional=marker == "?")
            for decorator, line_number, decorator_text in pending:
                item.validators.add(decorator)
                if decorator == "IsOptional":
                    item.optional = True
                constraint = VALIDATION_CODES.get(decorator)
                if constraint:
                    numeric = re.search(r"\(\s*(-?\d+(?:\.\d+)?)", decorator_text)
                    if numeric:
                        number_text = numeric.group(1)
                        item.constraints[constraint] = (
                            float(number_text) if "." in number_text else int(number_text)
                        )
                item.evidence.append(
                    Evidence(
                        self._relative(path),
                        f"line {line_number}",
                        decorator_text,
                    )
                )
            item.evidence.append(
                Evidence(self._relative(path), f"line {index + 1}", f"DTO property {name}.")
            )
            properties[name] = item
            pending = []

        if class_name:
            self.dto_classes[class_name] = properties
            self.dto_sources[class_name] = self._relative(path)

    def _index_controller(self, path: Path) -> None:
        lines = path.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            match = CONTROLLER_CLASS_PATTERN.match(line)
            if match:
                self.controllers[match.group(1)] = (path, lines, index)

    def dto_properties(self, schema: Mapping[str, Any]) -> dict[str, DtoProperty]:
        ref = schema.get("$ref")
        if not isinstance(ref, str) or not ref.startswith("#/components/schemas/"):
            return {}
        class_name = ref.rsplit("/", 1)[-1].replace("~1", "/").replace("~0", "~")
        return self.dto_classes.get(class_name, {})

    def route(self, operation_id: str) -> ControllerRoute | None:
        match = OPERATION_ID_PATTERN.fullmatch(operation_id)
        if not match:
            return None
        class_name, method_name = match.groups()
        controller = self.controllers.get(class_name)
        if controller is None:
            return None
        path, lines, class_line = controller
        method_line = next(
            (
                index
                for index in range(class_line + 1, len(lines))
                if (declaration := METHOD_DECLARATION_PATTERN.match(lines[index]))
                and declaration.group(1) == method_name
            ),
            None,
        )
        if method_line is None:
            return None

        prior_method_lines = [
            index
            for index in range(class_line + 1, method_line)
            if METHOD_DECLARATION_PATTERN.match(lines[index])
        ]
        method_region_start = prior_method_lines[-1] + 1 if prior_method_lines else class_line + 1
        guard_lines = [
            index
            for index in range(method_region_start, method_line)
            if re.match(r"^\s{2}@UseGuards\b", lines[index])
        ]
        guards: set[str] = set()
        guard_evidence: list[Evidence] = []
        for index in guard_lines:
            decorator_text = lines[index].strip()
            guards.update(re.findall(r"\b([A-Za-z_$][\w$]*Guard)\b", decorator_text))
            guard_evidence.append(
                Evidence(
                    self._relative(path),
                    f"line {index + 1}",
                    decorator_text,
                )
            )

        class_guard_lines: list[int] = []
        index = class_line - 1
        while index >= 0 and (not lines[index].strip() or lines[index].lstrip().startswith("@")):
            if re.match(r"^\s*@UseGuards\b", lines[index]):
                class_guard_lines.append(index)
            index -= 1
        for index in class_guard_lines:
            decorator_text = lines[index].strip()
            guards.update(re.findall(r"\b([A-Za-z_$][\w$]*Guard)\b", decorator_text))
            guard_evidence.append(
                Evidence(
                    self._relative(path),
                    f"line {index + 1}",
                    decorator_text,
                )
            )
        return ControllerRoute(
            self._relative(path),
            f"line {method_line + 1}",
            frozenset(guards),
            tuple(guard_evidence),
        )


def operation_key(method: str, endpoint: str) -> str:
    return f"{method.upper()} {endpoint}"


def _resolve_ref(spec: Mapping[str, Any], node: Mapping[str, Any]) -> Mapping[str, Any]:
    current: Mapping[str, Any] = node
    visited: set[str] = set()
    while isinstance(current.get("$ref"), str):
        ref = current["$ref"]
        if ref in visited or not ref.startswith("#/"):
            break
        visited.add(ref)
        target: Any = spec
        for segment in ref[2:].split("/"):
            segment = segment.replace("~1", "/").replace("~0", "~")
            if not isinstance(target, Mapping) or segment not in target:
                return current
            target = target[segment]
        if not isinstance(target, Mapping):
            return current
        current = {**target, **{key: value for key, value in current.items() if key != "$ref"}}
    return current


def _success_statuses(operation: Mapping[str, Any]) -> list[str]:
    responses = operation.get("responses")
    if not isinstance(responses, Mapping):
        return []
    return sorted(
        (str(status) for status in responses if SUCCESS_STATUS_PATTERN.fullmatch(str(status))),
        key=int,
    )


def _declared_error_status(
    operation: Mapping[str, Any], candidates: Sequence[str]
) -> str:
    responses = operation.get("responses")
    if not isinstance(responses, Mapping):
        return ""
    return next((code for code in candidates if code in responses), "")


def _auth_declared(operation: Mapping[str, Any], spec: Mapping[str, Any]) -> bool:
    if "security" in operation:
        security = operation["security"]
    elif "security" in spec:
        security = spec["security"]
    else:
        return False
    return (
        isinstance(security, list)
        and bool(security)
        and not any(isinstance(requirement, Mapping) and not requirement for requirement in security)
    )


def _path_pointer(path: str) -> str:
    return path.replace("~", "~0").replace("/", "~1")


def _short_api_code(api_id: str) -> str:
    match = re.fullmatch(r"API-(.+)-\d+", api_id)
    return match.group(1) if match else "API"


def _operation_slug(operation_id: str, method: str, endpoint: str) -> str:
    if "_" in operation_id:
        value = operation_id.split("_", 1)[1]
    else:
        value = f"{method}_{endpoint}"
    slug = re.sub(r"[^A-Za-z0-9]+", "", value).upper()
    return (slug or method)[:18]


def _candidate_id_prefix(api_id: str, operation_id: str, method: str, endpoint: str) -> str:
    return f"TC-{_short_api_code(api_id)}-{_operation_slug(operation_id, method, endpoint)}"


def _new_id_mapping(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "cases": {}, "reserved_ids": []}
    try:
        mapping = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid test case ID mapping at {path}: {error}") from error
    if not isinstance(mapping, dict):
        raise ValueError("Test case ID mapping root must be an object.")
    cases = mapping.get("cases", {})
    reserved_ids = mapping.get("reserved_ids", [])
    if not isinstance(cases, dict) or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in cases.items()
    ):
        raise ValueError("Test case ID mapping 'cases' must contain string keys and IDs.")
    if not isinstance(reserved_ids, list) or not all(
        isinstance(value, str) for value in reserved_ids
    ):
        raise ValueError("Test case ID mapping 'reserved_ids' must be a list of strings.")
    return {"version": 1, "cases": cases, "reserved_ids": reserved_ids}


def _read_inventory(path: Path) -> tuple[dict[str, dict[str, str]], bool]:
    if not path.is_file():
        raise ValueError(f"API Inventory not found: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        raw_rows = list(csv.reader(source))
    if not raw_rows:
        return {}, False
    header_present = raw_rows[0] == API_INVENTORY_COLUMNS
    data_rows = raw_rows[1:] if header_present else raw_rows
    if any(len(row) != len(API_INVENTORY_COLUMNS) for row in data_rows):
        raise ValueError(
            f"API Inventory must have {len(API_INVENTORY_COLUMNS)} columns per row."
        )
    if not header_present and data_rows and not API_ID_PATTERN.fullmatch(data_rows[0][0]):
        raise ValueError("API Inventory header is missing and its rows cannot be identified safely.")
    records: dict[str, dict[str, str]] = {}
    seen_ids: dict[str, str] = {}
    for row in data_rows:
        record = dict(zip(API_INVENTORY_COLUMNS, row))
        method = record["HTTP Method"].strip().upper()
        endpoint = record["Endpoint"].strip()
        key = operation_key(method, endpoint)
        if not method or not endpoint or key in records:
            raise ValueError(f"API Inventory contains a blank or duplicate operation: {key}")
        api_id = record["API ID"].strip()
        if api_id and not API_ID_PATTERN.fullmatch(api_id):
            raise ValueError(f"Invalid API ID in Inventory for {key}: {api_id}")
        if api_id in seen_ids and seen_ids[api_id] != key:
            raise ValueError(f"API ID {api_id} is assigned to multiple Inventory rows.")
        if api_id:
            seen_ids[api_id] = key
        records[key] = record
    return records, not header_present


def _request_schema(
    spec: Mapping[str, Any], operation: Mapping[str, Any]
) -> tuple[Mapping[str, Any] | None, str]:
    request_body = operation.get("requestBody")
    if not isinstance(request_body, Mapping):
        return None, ""
    content = request_body.get("content")
    if not isinstance(content, Mapping):
        return None, ""
    for content_type, media_type in content.items():
        if isinstance(media_type, Mapping) and isinstance(media_type.get("schema"), Mapping):
            return (
                _resolve_ref(spec, media_type["schema"]),
                f"requestBody/content/{content_type}/schema",
            )
    return None, ""


def _response_expectation(
    spec: Mapping[str, Any],
    operation: Mapping[str, Any],
    statuses: Sequence[str],
) -> tuple[str, str]:
    responses = operation.get("responses")
    if not isinstance(responses, Mapping):
        return "", ""
    descriptions: list[str] = []
    pointers: list[str] = []
    for status in statuses:
        response = responses.get(status)
        if not isinstance(response, Mapping):
            continue
        if response.get("description"):
            descriptions.append(str(response["description"]))
        content = response.get("content")
        if isinstance(content, Mapping):
            for content_type, media_type in content.items():
                if isinstance(media_type, Mapping) and isinstance(media_type.get("schema"), Mapping):
                    schema = _resolve_ref(spec, media_type["schema"])
                    schema_ref = media_type["schema"].get("$ref")
                    label = str(schema_ref or schema.get("type") or "response schema")
                    descriptions.append(f"Response conforms to declared schema {label}.")
                    pointers.append(f"responses/{status}/content/{content_type}/schema")
                    break
        pointers.append(f"responses/{status}")
    return "; ".join(dict.fromkeys(descriptions)), "; ".join(dict.fromkeys(pointers))


def _effective_properties(
    schema: Mapping[str, Any],
    dto_properties: Mapping[str, DtoProperty],
) -> tuple[dict[str, Mapping[str, Any]], set[str]]:
    properties = schema.get("properties")
    properties = properties if isinstance(properties, Mapping) else {}
    required = schema.get("required")
    required_names = set(required) if isinstance(required, list) else set()
    for name, dto_property in dto_properties.items():
        if dto_property.optional:
            required_names.discard(name)
    for name, property_schema in properties.items():
        dto_property = dto_properties.get(str(name))
        if dto_property and dto_property.optional:
            required_names.discard(str(name))
    return (
        {
            str(name): value
            for name, value in properties.items()
            if isinstance(value, Mapping)
        },
        required_names,
    )


def _property_constraints(
    schema: Mapping[str, Any], dto_property: DtoProperty | None
) -> dict[str, Any]:
    constraints = {
        key: schema[key]
        for key in (
            "minLength",
            "maxLength",
            "minimum",
            "maximum",
            "minItems",
            "maxItems",
            "minProperties",
            "maxProperties",
            "enum",
            "format",
            "pattern",
            "nullable",
        )
        if key in schema
    }
    if dto_property:
        for key, value in dto_property.constraints.items():
            constraints.setdefault(key, value)
        if dto_property.validators & {"IsEmail", "IsUrl", "IsUUID"}:
            constraints.setdefault(
                "format",
                "email"
                if "IsEmail" in dto_property.validators
                else "uri"
                if "IsUrl" in dto_property.validators
                else "uuid",
            )
        if dto_property.validators & {"Matches", "IsIn"}:
            constraints.setdefault("pattern", "DTO validation")
    return constraints


def _validation_status(
    operation: Mapping[str, Any],
    dto_property: DtoProperty | None,
    backend: BackendIndex,
) -> str:
    declared = _declared_error_status(operation, ("400", "422"))
    if declared:
        return declared
    if dto_property and dto_property.validators:
        return "400"
    if backend.validation_evidence:
        return "400"
    return ""


def _parameter_items(path_item: Mapping[str, Any], operation: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    parameters: dict[tuple[str, str], Mapping[str, Any]] = {}
    for source in (path_item.get("parameters", []), operation.get("parameters", [])):
        if not isinstance(source, list):
            continue
        for parameter in source:
            if isinstance(parameter, Mapping) and isinstance(parameter.get("name"), str):
                parameters[(str(parameter.get("in", "")), parameter["name"])] = parameter
    return list(parameters.values())


def _add_review_reason(candidate: Candidate, reason: str) -> None:
    if reason and reason not in candidate.review_reasons:
        candidate.review_reasons.append(reason)


def _build_candidate(
    *,
    api_id: str,
    module: str,
    method: str,
    endpoint: str,
    operation_id: str,
    scenario_key: str,
    title: str,
    scenario: str,
    test_type: str,
    priority: str,
    preconditions: str,
    steps: str,
    data_reference: str,
    expected_status: str,
    expected_response: str,
    evidence: Sequence[Evidence],
    review_reasons: Sequence[str],
    created_date: str,
) -> Candidate:
    notes = "; ".join(review_reasons)
    row = {
        "Test Case ID": "",
        "Requirement ID": "",
        "API ID": api_id,
        "Module": module,
        "HTTP Method": method,
        "Endpoint": endpoint,
        "Test Case Title": title,
        "Test Scenario": scenario,
        "Test Type": test_type,
        "Priority": priority,
        "Preconditions": preconditions,
        "Test Steps": steps,
        "Test Data Reference": data_reference,
        "Expected HTTP Status": expected_status,
        "Expected Response": expected_response,
        "Expected Database Effect": "",
        "Postconditions": "",
        "Automation Status": "Thủ công",
        "Created By": "Test Case Generator",
        "Created Date": created_date,
        "Review Status": "Bản nháp",
        "Notes": notes,
    }
    prefix = _candidate_id_prefix(api_id, operation_id, method, endpoint)
    return Candidate(api_id, scenario_key, prefix, row, list(evidence), list(review_reasons))


def _test_data_reference(api_id: str, field_name: str = "VALID") -> str:
    token = re.sub(r"[^A-Z0-9]+", "_", field_name.upper()).strip("_")
    return f"DATA_{_short_api_code(api_id)}_{token}"


def _common_review_reasons(
    operation: Mapping[str, Any],
    api_has_security_evidence: bool,
    expected_status: str,
    expected_response: str,
) -> list[str]:
    reasons = [
        "Requirement ID chưa có nguồn yêu cầu đầu vào.",
        "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence.",
    ]
    if not expected_status:
        reasons.append("Expected HTTP Status chưa có căn cứ khai báo.")
    if not expected_response:
        reasons.append("Expected Response chưa được mô tả đủ trong OpenAPI.")
    if not api_has_security_evidence and "security" not in operation:
        reasons.append("Security chưa được khai báo tại operation hoặc global.")
    return reasons


def _operation_evidence(
    path: str, method: str, detail: str
) -> Evidence:
    pointer = f"#/paths/{_path_pointer(path)}/{method.lower()}"
    return Evidence("testing/openapi/openapi.json", pointer, detail)


def _make_steps(method: str, endpoint: str, data_reference: str) -> str:
    return (
        f"Fixture tham chiếu: {data_reference}. "
        f"Request: {method} {endpoint}."
    )


def _security_schemes(
    operation: Mapping[str, Any], spec: Mapping[str, Any]
) -> list[tuple[str, Mapping[str, Any]]]:
    requirements = operation.get("security", spec.get("security", []))
    definitions = spec.get("components", {}).get("securitySchemes", {})
    if not isinstance(requirements, list) or not isinstance(definitions, Mapping):
        return []
    schemes: list[tuple[str, Mapping[str, Any]]] = []
    for requirement in requirements:
        if not isinstance(requirement, Mapping):
            continue
        for name in requirement:
            definition = definitions.get(name)
            if isinstance(definition, Mapping):
                schemes.append((str(name), definition))
    return schemes


def _manual_steps(
    candidate: Candidate,
    operation: Mapping[str, Any],
    path_item: Mapping[str, Any],
    spec: Mapping[str, Any],
    route: ControllerRoute | None,
) -> str:
    row = candidate.row
    endpoint = row["Endpoint"]
    method = row["HTTP Method"]
    scenario_key = candidate.scenario_key
    path_fields = re.findall(r"\{([^{}]+)\}", endpoint)
    request_path = endpoint
    for field_name in path_fields:
        request_path = request_path.replace(f"{{{field_name}}}", f"{{{{{field_name}}}}}")
    lines = [
        f"1. Trong Postman tạo request {method} với URL `{{{{baseUrl}}}}{request_path}`; thay từng path variable bằng fixture nêu trong Preconditions.",
    ]

    auth_case = scenario_key.startswith("auth-") or scenario_key.startswith("role-")
    invalid_token_case = scenario_key == "auth-invalid-token"
    missing_token_case = scenario_key == "auth-missing-token"
    cookie_security = any(
        definition.get("in") == "cookie"
        for _, definition in _security_schemes(operation, spec)
    ) or endpoint == "/auth/refresh"
    requires_auth = _auth_declared(operation, spec) or bool(
        route and route.guards & {"JwtAuthGuard", "AdminRoleGuard"}
    )
    if cookie_security:
        cookie_name = "uth_refresh_token"
        for _, definition in _security_schemes(operation, spec):
            if definition.get("in") == "cookie" and definition.get("name"):
                cookie_name = str(definition["name"])
        if missing_token_case:
            lines.append(f"2. Tab Cookies/Headers: không gửi cookie `{cookie_name}`.")
        elif invalid_token_case:
            lines.append(
                f"2. Tab Cookies/Headers: gửi `{cookie_name}={{AUTH_INVALID_REFRESH_COOKIE}}` (placeholder, không phải token thật)."
            )
        elif requires_auth or scenario_key.startswith("success") or scenario_key.startswith("refresh-"):
            lines.append(
                f"2. Gửi cookie `{cookie_name}={{AUTH_VALID_REFRESH_COOKIE}}` từ fixture đã duyệt; không dùng Bearer thay thế."
            )
    elif requires_auth:
        if missing_token_case:
            lines.append("2. Tab Authorization: chọn No Auth hoặc xóa Authorization header.")
        elif invalid_token_case:
            lines.append(
                "2. Tab Authorization: Bearer Token `{{AUTH_INVALID_ACCESS_TOKEN}}` (placeholder, không phải token thật)."
            )
        elif scenario_key == "role-denied-student":
            lines.append(
                "2. Tab Authorization: Bearer Token `{{AUTH_VALID_STUDENT_ACCESS_TOKEN}}` từ fixture đã duyệt."
            )
        elif "AdminRoleGuard" in (route.guards if route else frozenset()):
            lines.append(
                "2. Tab Authorization: Bearer Token `{{AUTH_VALID_ADMIN_ACCESS_TOKEN}}` từ fixture đã duyệt."
            )
        else:
            lines.append(
                "2. Tab Authorization: Bearer Token `{{AUTH_VALID_ACCESS_TOKEN}}` từ fixture đã duyệt."
            )
    else:
        lines.append("2. Không gửi credential trừ khi Test Scenario yêu cầu token tùy chọn.")

    parameters = _parameter_items(path_item, operation)
    path_parameters = [item for item in parameters if item.get("in") == "path"]
    query_parameters = [item for item in parameters if item.get("in") == "query"]
    header_parameters = [item for item in parameters if item.get("in") == "header"]
    cookie_parameters = [item for item in parameters if item.get("in") == "cookie"]
    if path_parameters or query_parameters or header_parameters or cookie_parameters:
        descriptions: list[str] = []
        for parameter in path_parameters:
            descriptions.append(f"path `{parameter.get('name')}` theo fixture")
        for parameter in query_parameters:
            descriptions.append(f"query `{parameter.get('name')}` theo tình huống")
        for parameter in header_parameters:
            descriptions.append(f"header `{parameter.get('name')}` theo fixture")
        for parameter in cookie_parameters:
            descriptions.append(f"cookie `{parameter.get('name')}` theo fixture")
        lines.append("3. Điền tham số: " + "; ".join(descriptions) + ".")

    request_body = operation.get("requestBody")
    if isinstance(request_body, Mapping):
        content = request_body.get("content")
        content_types = list(content) if isinstance(content, Mapping) else []
        if content_types:
            lines.append(
                f"{len(lines) + 1}. Chọn Body phù hợp với Content-Type `{content_types[0]}`; nạp fixture `{row['Test Data Reference']}` và chỉ thay đổi trường được nêu trong Test Scenario."
            )
        else:
            lines.append(
                f"{len(lines) + 1}. Cấu hình request body theo fixture `{row['Test Data Reference']}`; Content-Type chưa khai báo, cần xác minh."
            )
    elif method in {"GET", "DELETE"}:
        lines.append(
            f"{len(lines) + 1}. Không thêm request body; tham số chỉ đặt tại URL/header/cookie như mô tả."
        )

    lines.append(
        f"{len(lines) + 1}. Gửi request thủ công; đối chiếu status `{row['Expected HTTP Status'] or 'chưa xác định'}` và các trường response trong Expected Response."
    )
    if row["Expected Database Effect"]:
        lines.append(
            f"{len(lines) + 1}. Xác minh tác động dữ liệu được nêu; khôi phục fixture nếu case làm thay đổi trạng thái."
        )
    else:
        lines.append(
            f"{len(lines) + 1}. Không kết luận tác động database; nếu cần kiểm tra, đối chiếu qua công cụ QA được cấp quyền và ghi nhận kết quả."
        )
    return "\n".join(lines)


def _generate_candidates(
    spec: Mapping[str, Any],
    inventory: Mapping[str, Mapping[str, str]],
    api_id_mapping: Mapping[str, Any],
    backend: BackendIndex,
) -> tuple[list[Candidate], set[str], list[str]]:
    paths = spec.get("paths")
    if not isinstance(paths, Mapping):
        raise ValueError("OpenAPI document must contain a paths object.")
    global_security = spec.get("security")
    operations: list[tuple[str, str, Mapping[str, Any], Mapping[str, Any]]] = []
    for endpoint, path_item in paths.items():
        if not isinstance(endpoint, str) or not isinstance(path_item, Mapping):
            continue
        for raw_method, operation in path_item.items():
            method = str(raw_method).upper()
            if method in METHODS and isinstance(operation, Mapping):
                operations.append((method, endpoint, operation, path_item))

    api_mapping = api_id_mapping.get("operations", {})
    if not isinstance(api_mapping, Mapping):
        raise ValueError("API ID mapping must have an operations object.")

    candidates: list[Candidate] = []
    api_keys_with_cases: set[str] = set()
    warnings: list[str] = []
    operation_context: dict[
        str, tuple[Mapping[str, Any], Mapping[str, Any], ControllerRoute | None]
    ] = {}
    created_date = date.today().isoformat()

    for method, endpoint, operation, path_item in operations:
        key = operation_key(method, endpoint)
        inventory_row = inventory.get(key, {})
        api_id = str(inventory_row.get("API ID", "")).strip()
        mapped_id = str(api_mapping.get(key, "")).strip()
        if not API_ID_PATTERN.fullmatch(api_id) and API_ID_PATTERN.fullmatch(mapped_id):
            api_id = mapped_id
        if not API_ID_PATTERN.fullmatch(api_id):
            warnings.append(f"Skipped {key}: no valid API ID in Inventory or ID mapping.")
            continue
        if key not in inventory:
            warnings.append(f"{key}: operation is missing from API Inventory.")
        module = str(inventory_row.get("Module") or (operation.get("tags") or [""])[0] or "")
        summary = str(operation.get("summary") or "")
        operation_id = str(operation.get("operationId") or "")
        route = backend.route(operation_id) if operation_id else None
        operation_context[key] = (operation, path_item, route)
        route_guards = route.guards if route else frozenset()
        oas_security = _auth_declared(operation, spec)
        requires_auth = oas_security or "JwtAuthGuard" in route_guards
        security_evidence = oas_security or bool(route_guards & {"JwtAuthGuard", "OptionalJwtAuthGuard"})
        success_statuses = _success_statuses(operation)
        success_status = ", ".join(success_statuses)
        success_response, response_pointer = _response_expectation(
            spec, operation, success_statuses
        )
        operation_evidence = _operation_evidence(
            endpoint, method, f"{method} {endpoint} operation contract."
        )
        success_evidence = [operation_evidence]
        if response_pointer:
            success_evidence.append(
                Evidence(
                    "testing/openapi/openapi.json",
                    f"#/paths/{_path_pointer(endpoint)}/{method.lower()}/{response_pointer}",
                    "Declared success response status/description/schema.",
                )
            )
        if route:
            success_evidence.append(
                Evidence(route.source, route.method_location, f"Controller method for {operation_id}.")
            )

        body_schema, body_pointer = _request_schema(spec, operation)
        dto_properties: dict[str, DtoProperty] = {}
        dto_class_name = ""
        if body_schema is not None:
            raw_ref = (
                operation.get("requestBody", {})
                .get("content", {})
                if isinstance(operation.get("requestBody"), Mapping)
                else {}
            )
            if isinstance(raw_ref, Mapping):
                for media_type in raw_ref.values():
                    if isinstance(media_type, Mapping) and isinstance(media_type.get("schema"), Mapping):
                        ref = media_type["schema"].get("$ref")
                        if isinstance(ref, str):
                            dto_class_name = ref.rsplit("/", 1)[-1].replace("~1", "/").replace("~0", "~")
                            break
            dto_properties = backend.dto_properties({"$ref": f"#/components/schemas/{dto_class_name}"}) if dto_class_name else {}
        body_properties, required_fields = (
            _effective_properties(body_schema, dto_properties)
            if body_schema is not None
            else ({}, set())
        )
        base_review = _common_review_reasons(
            operation, security_evidence, success_status, success_response
        )

        if success_statuses:
            for status_index, status in enumerate(success_statuses):
                response_text, status_response_pointer = _response_expectation(
                    spec, operation, [status]
                )
                if key in {"POST /auth/login", "POST /auth/register", "POST /auth/refresh"}:
                    response_text = (
                        "Response theo contract OpenAPI; xác minh access token trong body và refresh token "
                        "trong cookie HttpOnly theo controller."
                    )
                positive_data = (
                    "AUTH_VALID_STUDENT_USERNAME"
                    if key == "POST /auth/login"
                    else "AUTH_NEW_STUDENT_VALID"
                    if key == "POST /auth/register"
                    else _test_data_reference(api_id)
                )
                positive_preconditions = (
                    f"Chuẩn bị fixture `{positive_data}` trong môi trường kiểm thử đã được duyệt; "
                    "chỉ dùng placeholder, không ghi credential thật."
                )
                if requires_auth and key != "POST /auth/refresh":
                    if any(
                        definition.get("in") == "cookie"
                        for _, definition in _security_schemes(operation, spec)
                    ):
                        positive_preconditions += (
                            " Có refresh cookie hợp lệ từ fixture; không dùng access token Bearer thay thế."
                        )
                    else:
                        role_reference = (
                            "AUTH_VALID_ADMIN"
                            if "AdminRoleGuard" in route_guards
                            else "AUTH_VALID_USER"
                        )
                        positive_preconditions += (
                            f" Có fixture Bearer token hợp lệ `{role_reference}`; "
                            "generator không tạo tài khoản/token."
                        )
                positive_reasons = list(
                    _common_review_reasons(
                        operation,
                        security_evidence,
                        status,
                        response_text,
                    )
                )
                case = _build_candidate(
                    api_id=api_id,
                    module=module,
                    method=method,
                    endpoint=endpoint,
                    operation_id=operation_id,
                    scenario_key="success" if status_index == 0 else f"success-{status}",
                    title=f"Thành công HTTP {status} - {summary or operation_id or endpoint}",
                    scenario=(
                        f"Với fixture hợp lệ, thực hiện {method} {endpoint} và kiểm tra riêng "
                        f"nhánh phản hồi HTTP {status}."
                    ),
                    test_type="Kiểm thử tích cực",
                    priority="Cao"
                    if requires_auth or method in {"POST", "PUT", "PATCH", "DELETE"}
                    else "Trung bình",
                    preconditions=positive_preconditions,
                    steps=_make_steps(method, endpoint, positive_data),
                    data_reference=positive_data,
                    expected_status=status,
                    expected_response=response_text,
                    evidence=[
                        *success_evidence,
                        *(
                            [
                                Evidence(
                                    "testing/openapi/openapi.json",
                                    f"#/paths/{_path_pointer(endpoint)}/{method.lower()}/{status_response_pointer}",
                                    "Response description/schema for this specific success status.",
                                )
                            ]
                            if status_response_pointer
                            else []
                        ),
                    ],
                    review_reasons=positive_reasons,
                    created_date=created_date,
                )
                candidates.append(case)
                api_keys_with_cases.add(key)

        if requires_auth:
            auth_evidence = [operation_evidence]
            auth_evidence.extend(route.guard_evidence if route else ())
            auth_evidence.extend(backend.jwt_evidence[:1])
            if not oas_security:
                warnings.append(
                    f"{key}: JWT guard found in controller but OpenAPI security is absent or optional."
                )
            for scenario_key, label, reference in (
                ("auth-missing-token", "Thiếu token", "AUTH_MISSING_TOKEN"),
                ("auth-invalid-token", "Token không hợp lệ", "AUTH_INVALID_TOKEN"),
            ):
                status = _declared_error_status(operation, ("401",))
                reasons = [
                    "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence."
                ]
                if not status:
                    reasons.append("OpenAPI không khai báo 401 cho operation này.")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=scenario_key,
                        title=f"{label} - {summary or endpoint}",
                        scenario=f"Thử {method} {endpoint} với {label.lower()}.",
                        test_type="Kiểm thử xác thực",
                        priority="Cao",
                        preconditions=f"Không dùng credential thật; dữ liệu tham chiếu {reference}.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=status,
                        expected_response=(
                            "Request bị từ chối do authentication không hợp lệ; "
                            "body lỗi cần đối chiếu contract."
                        ),
                        evidence=auth_evidence,
                        review_reasons=reasons,
                        created_date=created_date,
                    )
                )
                api_keys_with_cases.add(key)

        if "AdminRoleGuard" in route_guards:
            role_evidence = [operation_evidence, *route.guard_evidence]
            role_evidence.extend(backend.admin_role_evidence[:1])
            role_status = "403" if backend.admin_role_evidence else _declared_error_status(operation, ("403",))
            reasons = [
                "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence."
            ]
            if not role_status:
                reasons.append("Expected HTTP Status 403 chưa có khai báo hoặc bằng chứng guard.")
            candidates.append(
                _build_candidate(
                    api_id=api_id,
                    module=module,
                    method=method,
                    endpoint=endpoint,
                    operation_id=operation_id,
                    scenario_key="role-denied-student",
                    title=f"Từ chối vai trò STUDENT - {summary or endpoint}",
                    scenario=f"Thử {method} {endpoint} với token STUDENT trên route có AdminRoleGuard.",
                    test_type="Kiểm thử phân quyền",
                    priority="Cao",
                    preconditions="Dùng fixture token STUDENT hợp lệ theo quy trình QA; không tạo tài khoản.",
                    steps=_make_steps(method, endpoint, "AUTH_VALID_STUDENT"),
                    data_reference="AUTH_VALID_STUDENT",
                    expected_status=role_status,
                    expected_response=(
                        "AdminRoleGuard từ chối role khác ADMIN; chi tiết body cần đối chiếu contract."
                    ),
                    evidence=role_evidence,
                    review_reasons=reasons,
                    created_date=created_date,
                )
            )
            api_keys_with_cases.add(key)

        if key == "POST /auth/login" and "401" in operation.get("responses", {}):
            evidence = [operation_evidence]
            evidence.extend(
                [
                    Evidence(
                        "backend/src/auth/auth.controller.ts",
                        "lines 185-197",
                        "Login documents 401 and uses optional rememberMe for refresh-cookie behavior.",
                    ),
                    Evidence(
                        "backend/src/auth/auth.service.ts",
                        "lines 72-88",
                        "Login rejects inactive users or invalid credentials with UnauthorizedException.",
                    ),
                ]
            )
            candidates.append(
                _build_candidate(
                    api_id=api_id,
                    module=module,
                    method=method,
                    endpoint=endpoint,
                    operation_id=operation_id,
                    scenario_key="login-invalid-password",
                    title="Từ chối mật khẩu không hợp lệ",
                    scenario="Đăng nhập với identifier fixture hợp lệ nhưng mật khẩu không hợp lệ.",
                    test_type="Kiểm thử xác thực",
                    priority="Cao",
                    preconditions="Dùng fixture không nhạy cảm theo AUTH_INVALID_PASSWORD; không ghi mật khẩu vào CSV.",
                    steps=_make_steps(method, endpoint, "AUTH_INVALID_PASSWORD"),
                    data_reference="AUTH_INVALID_PASSWORD",
                    expected_status="401",
                    expected_response="Thông tin đăng nhập không hợp lệ theo contract OpenAPI.",
                    evidence=evidence,
                    review_reasons=[
                        "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence."
                    ],
                    created_date=created_date,
                )
            )

        if key == "POST /auth/login" and "rememberMe" in dto_properties:
            remember_property = dto_properties["rememberMe"]
            if remember_property.optional and "IsBoolean" in remember_property.validators:
                remember_evidence = [
                    operation_evidence,
                    Evidence(
                        backend.dto_sources.get(dto_class_name, "backend/src/auth/dto/login.dto.ts"),
                        "LoginDto.rememberMe",
                        "Optional boolean field validated by IsBoolean.",
                    ),
                    Evidence(
                        "backend/src/auth/auth.controller.ts",
                        "lines 191-197, 720-733",
                        "rememberMe controls cookie persistence; refresh cookies are HttpOnly.",
                    ),
                ]
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key="login-remember-me-disabled",
                        title="Đăng nhập khi tắt rememberMe",
                        scenario=(
                            "Đăng nhập với rememberMe=false và fixture hợp lệ; kiểm tra access token "
                            "và cookie đăng nhập theo contract."
                        ),
                        test_type="Kiểm thử tích cực",
                        priority="Cao",
                        preconditions="Dùng AUTH_VALID_STUDENT_REMEMBER_OFF; fixture không chứa credential trong tài liệu.",
                        steps=_make_steps(method, endpoint, "AUTH_VALID_STUDENT_REMEMBER_OFF"),
                        data_reference="AUTH_VALID_STUDENT_REMEMBER_OFF",
                        expected_status=success_status,
                        expected_response=(
                            "Response có access token; refresh/remember cookies vẫn HttpOnly, "
                            "chính sách thời hạn khi rememberMe=false cần xác minh."
                        ),
                        evidence=remember_evidence,
                        review_reasons=[
                            "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence.",
                            "Cần xác minh chính sách cookie khi rememberMe=false trong môi trường kiểm thử.",
                        ],
                        created_date=created_date,
                    )
                )

        if body_schema is not None:
            request_evidence = [operation_evidence]
            if body_pointer:
                request_evidence.append(
                    Evidence(
                        "testing/openapi/openapi.json",
                        f"#/paths/{_path_pointer(endpoint)}/{method.lower()}/{body_pointer}",
                        "Request body schema and property constraints.",
                    )
                )
            if dto_class_name and dto_class_name in backend.dto_sources:
                request_evidence.append(
                    Evidence(
                        backend.dto_sources[dto_class_name],
                        dto_class_name,
                        "Backend DTO validation metadata.",
                    )
                )
            if backend.validation_evidence:
                request_evidence.extend(backend.validation_evidence[:1])

            typed_properties = [
                (name, property_schema, dto_properties.get(name))
                for name, property_schema in body_properties.items()
                if property_schema.get("type") in {"string", "integer", "number", "boolean"}
            ]
            for property_name, property_schema, dto_property in typed_properties:
                reference = _test_data_reference(api_id, f"{property_name}_INVALID_TYPE")
                invalid_status = _validation_status(operation, dto_property, backend)
                reasons = [
                    "Expected Database Effect: request validation phải bị từ chối trước khi handler ghi dữ liệu."
                ]
                if not invalid_status:
                    reasons.append("Expected HTTP Status cần xác minh vì chưa có response validation công khai.")
                if not dto_property or not dto_property.validators:
                    reasons.append("Cần xác minh hành vi transform/validation phía backend cho kiểu dữ liệu này.")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=f"invalid-type-{property_name}",
                        title=f"Sai kiểu dữ liệu - {property_name}",
                        scenario=(
                            f"Gửi sai kiểu cho trường {property_name} theo schema "
                            f"type={property_schema.get('type')}."
                        ),
                        test_type="Kiểm thử hợp lệ dữ liệu",
                        priority="Trung bình",
                        preconditions="Các trường khác hợp lệ theo fixture.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=invalid_status,
                        expected_response=(
                            "ValidationPipe/DTO từ chối kiểu dữ liệu không phù hợp; đối chiếu message và danh sách lỗi."
                            if invalid_status
                            else "Cần xác minh contract lỗi cho kiểu dữ liệu không phù hợp."
                        ),
                        evidence=[
                            *request_evidence,
                            *(dto_property.evidence if dto_property else []),
                        ],
                        review_reasons=reasons,
                        created_date=created_date,
                    )
                )

            formatted_properties = [
                (name, dto_property)
                for name, dto_property in dto_properties.items()
                if dto_property.validators
                & {"IsEmail", "IsUUID", "IsUrl", "Matches", "IsIn", "IsEnum"}
            ]
            for property_name, dto_property in formatted_properties:
                reference = _test_data_reference(api_id, f"{property_name}_INVALID_FORMAT")
                invalid_status = _validation_status(operation, dto_property, backend)
                reasons = [
                    "Expected Database Effect: request validation phải bị từ chối trước khi handler ghi dữ liệu."
                ]
                if not invalid_status:
                    reasons.append("Expected HTTP Status cần xác minh vì chưa có response validation công khai.")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=f"invalid-format-{property_name}",
                        title=f"Sai định dạng - {property_name}",
                        scenario=f"Gửi giá trị không đúng định dạng được DTO xác thực cho {property_name}.",
                        test_type="Kiểm thử hợp lệ dữ liệu",
                        priority="Trung bình",
                        preconditions="Các trường khác hợp lệ theo fixture.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=invalid_status,
                        expected_response=(
                            "DTO từ chối định dạng/giá trị không hợp lệ; đối chiếu message và field được báo lỗi."
                            if invalid_status
                            else "Cần xác minh contract lỗi cho định dạng/giá trị không hợp lệ."
                        ),
                        evidence=[
                            *request_evidence,
                            *dto_property.evidence,
                        ],
                        review_reasons=reasons,
                        created_date=created_date,
                    )
                )

            for required_name in sorted(required_fields):
                reference = _test_data_reference(api_id, f"MISSING_{required_name}")
                dto_property = dto_properties.get(required_name)
                status = _validation_status(operation, dto_property, backend)
                reasons = [
                    "Expected Database Effect: request thiếu trường bắt buộc phải bị từ chối trước khi handler ghi dữ liệu."
                ]
                if not status:
                    reasons.append("Expected HTTP Status cần xác minh vì chưa có response validation công khai.")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=f"required-missing-{required_name}",
                        title=f"Thiếu trường bắt buộc {required_name}",
                        scenario=(
                            f"Gửi request thiếu trường {required_name} được khai báo bắt buộc; "
                            "các fixture khác hợp lệ."
                        ),
                        test_type="Kiểm thử hợp lệ dữ liệu",
                        priority="Cao" if required_name in {"identifier", "password", "username", "email"} else "Trung bình",
                        preconditions="Dùng fixture hợp lệ ngoại trừ trường được kiểm tra.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=status,
                        expected_response=(
                            f"Validation từ chối trường bắt buộc `{required_name}`; "
                            "đối chiếu lỗi theo field và không tạo/cập nhật dữ liệu."
                        ),
                        evidence=[
                            *request_evidence,
                            *(dto_property.evidence if dto_property else []),
                        ],
                        review_reasons=reasons,
                        created_date=created_date,
                    )
                )

            constrained: list[tuple[str, Mapping[str, Any], DtoProperty | None, dict[str, Any]]] = []
            for property_name, property_schema in body_properties.items():
                dto_property = dto_properties.get(property_name)
                constraints = _property_constraints(property_schema, dto_property)
                if constraints:
                    constrained.append((property_name, property_schema, dto_property, constraints))
            for property_name, property_schema, dto_property, constraints in constrained:
                schema_type = property_schema.get("type")
                for bound_name in (
                    "minLength",
                    "minimum",
                    "minItems",
                    "minProperties",
                    "maxLength",
                    "maximum",
                    "maxItems",
                    "maxProperties",
                ):
                    if bound_name not in constraints:
                        continue
                    applicable_types = {
                        "minLength": {"string"},
                        "maxLength": {"string"},
                        "minimum": {"integer", "number"},
                        "maximum": {"integer", "number"},
                        "minItems": {"array"},
                        "maxItems": {"array"},
                        "minProperties": {"object"},
                        "maxProperties": {"object"},
                    }[bound_name]
                    if schema_type and schema_type not in applicable_types:
                        continue
                    bound = constraints[bound_name]
                    direction = "min" if bound_name.startswith("min") else "max"
                    boundary_key = f"boundary-{property_name}-{direction}"
                    reference = _test_data_reference(
                        api_id, f"{property_name}_{direction.upper()}_BOUNDARY"
                    )
                    status = next(
                        (
                            item
                            for item in success_statuses
                            if item in operation.get("responses", {})
                        ),
                        "",
                    )
                    response_text, _ = _response_expectation(spec, operation, [status]) if status else ("", "")
                    boundary_candidate = _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=boundary_key,
                        title=f"Biên {direction} hợp lệ - {property_name}",
                        scenario=(
                            f"Gửi trường `{property_name}` đúng giới hạn `{bound_name}={bound}`; "
                            "các trường khác dùng fixture hợp lệ."
                        ),
                        test_type="Kiểm thử giá trị biên",
                        priority="Trung bình",
                        preconditions=(
                            f"Nạp fixture `{reference}`; giữ nguyên mọi trường khác ở giá trị hợp lệ."
                        ),
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=status,
                        expected_response=response_text,
                        evidence=[
                            *request_evidence,
                            *(dto_property.evidence if dto_property else []),
                        ],
                        review_reasons=_common_review_reasons(
                            operation, security_evidence, status, response_text
                        ),
                        created_date=created_date,
                    )
                    candidates.append(boundary_candidate)

                    invalid_reference = _test_data_reference(
                        api_id, f"{property_name}_{direction.upper()}_OUT_OF_RANGE"
                    )
                    invalid_status = _validation_status(operation, dto_property, backend)
                    invalid_value = (
                        f"{bound}-1"
                        if direction == "min"
                        else f"{bound}+1"
                    )
                    invalid_reasons = [
                        "Expected Database Effect: validation phải từ chối request trước khi handler ghi dữ liệu."
                    ]
                    if not invalid_status:
                        invalid_reasons.append(
                            "Expected HTTP Status cần xác minh; backend chưa có validation contract cho tham số này."
                        )
                    candidates.append(
                        _build_candidate(
                            api_id=api_id,
                            module=module,
                            method=method,
                            endpoint=endpoint,
                            operation_id=operation_id,
                            scenario_key=f"boundary-invalid-{property_name}-{direction}",
                            title=f"Vượt biên {direction} - {property_name}",
                            scenario=(
                                f"Gửi `{property_name}` ngoài giới hạn `{bound_name}={bound}` "
                                f"({invalid_value} theo kiểu dữ liệu của trường)."
                            ),
                            test_type="Kiểm thử giá trị biên",
                            priority="Trung bình",
                            preconditions=(
                                "Các trường còn lại hợp lệ; fixture chứa riêng giá trị vượt biên."
                            ),
                            steps=_make_steps(method, endpoint, invalid_reference),
                            data_reference=invalid_reference,
                            expected_status=invalid_status,
                            expected_response=(
                                f"Trường `{property_name}` bị validation từ chối; không lưu thay đổi."
                                if invalid_status
                                else "Cần xác minh response khi trường vượt giới hạn."
                            ),
                            evidence=[
                                *request_evidence,
                                *(dto_property.evidence if dto_property else []),
                            ],
                            review_reasons=invalid_reasons,
                            created_date=created_date,
                        )
                    )

                if "enum" in constraints:
                    reference = _test_data_reference(api_id, f"{property_name}_INVALID_ENUM")
                    invalid_status = _validation_status(operation, dto_property, backend)
                    reasons = [
                        "Expected Database Effect: validation phải từ chối request trước khi handler ghi dữ liệu."
                    ]
                    if not invalid_status:
                        reasons.append("Expected HTTP Status cần xác minh vì chưa có response validation công khai.")
                    candidates.append(
                        _build_candidate(
                            api_id=api_id,
                            module=module,
                            method=method,
                            endpoint=endpoint,
                            operation_id=operation_id,
                            scenario_key=f"invalid-enum-{property_name}",
                            title=f"Giá trị enum không hợp lệ - {property_name}",
                            scenario=f"Gửi giá trị ngoài enum đã khai báo cho trường {property_name}.",
                            test_type="Kiểm thử tiêu cực",
                            priority="Trung bình",
                            preconditions="Các trường khác hợp lệ theo fixture.",
                            steps=_make_steps(method, endpoint, reference),
                            data_reference=reference,
                            expected_status=invalid_status,
                            expected_response=(
                                f"Giá trị ngoài enum của `{property_name}` bị từ chối."
                                if invalid_status
                                else f"Cần xác minh response cho enum không hợp lệ của `{property_name}`."
                            ),
                            evidence=[
                                *request_evidence,
                                *(dto_property.evidence if dto_property else []),
                            ],
                            review_reasons=reasons,
                            created_date=created_date,
                        )
                    )
                if (
                    constraints.get("nullable") is True
                    and property_name in required_fields
                ):
                    reference = _test_data_reference(api_id, f"{property_name}_NULL")
                    status = success_statuses[0] if success_statuses else ""
                    response_text, _ = (
                        _response_expectation(spec, operation, [status])
                        if status
                        else ("", "")
                    )
                    candidates.append(
                        _build_candidate(
                            api_id=api_id,
                            module=module,
                            method=method,
                            endpoint=endpoint,
                            operation_id=operation_id,
                            scenario_key=f"null-required-{property_name}",
                            title=f"Giá trị null được cho phép - {property_name}",
                            scenario=(
                                f"Gửi `null` cho trường `{property_name}` được schema cho phép nullable."
                            ),
                            test_type="Kiểm thử tích cực",
                            priority="Trung bình",
                            preconditions="Các trường khác hợp lệ theo fixture.",
                            steps=_make_steps(method, endpoint, reference),
                            data_reference=reference,
                            expected_status=status,
                            expected_response=response_text,
                            evidence=[
                                *request_evidence,
                                *(dto_property.evidence if dto_property else []),
                            ],
                            review_reasons=_common_review_reasons(
                                operation, security_evidence, status, response_text
                            ),
                            created_date=created_date,
                        )
                    )

            if body_schema is not None and body_schema.get("type") == "object":
                extra_reference = _test_data_reference(api_id, "UNKNOWN_FIELD")
                extra_status = "400" if backend.validation_evidence else ""
                extra_reasons = [
                    "Global ValidationPipe cấu hình whitelist/forbidNonWhitelisted; gửi trường dư phải bị chặn."
                ]
                if not extra_status:
                    extra_reasons.append("Expected HTTP Status cần xác minh do không tìm thấy ValidationPipe.")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key="unexpected-body-field",
                        title="Từ chối trường ngoài DTO",
                        scenario=(
                            "Thêm một thuộc tính không được khai báo vào JSON body; giữ nguyên các trường hợp lệ."
                        ),
                        test_type="Kiểm thử bảo mật",
                        priority="Trung bình",
                        preconditions="Body hợp lệ theo fixture ngoài một thuộc tính `unexpectedField`.",
                        steps=_make_steps(method, endpoint, extra_reference),
                        data_reference=extra_reference,
                        expected_status=extra_status,
                        expected_response=(
                            "ValidationPipe từ chối thuộc tính ngoài whitelist; không áp dụng mass assignment."
                            if extra_status
                            else "Cần xác minh phản hồi khi body có trường dư."
                        ),
                        evidence=[
                            *request_evidence,
                            *backend.validation_evidence[:1],
                        ],
                        review_reasons=extra_reasons,
                        created_date=created_date,
                    )
                )

        for parameter in _parameter_items(path_item, operation):
            raw_schema = parameter.get("schema")
            if not isinstance(raw_schema, Mapping):
                continue
            parameter_schema = _resolve_ref(spec, raw_schema)
            parameter_name = str(parameter.get("name", "parameter"))
            location = str(parameter.get("in", "query"))
            constraints = _property_constraints(parameter_schema, None)
            parameter_evidence = [
                operation_evidence,
                Evidence(
                    "testing/openapi/openapi.json",
                    f"#/paths/{_path_pointer(endpoint)}/{method.lower()}/parameters",
                    f"Parameter {location}:{parameter_name} contract.",
                ),
            ]
            declared_error = _declared_error_status(operation, ("400", "422"))
            generated_invalid_case = False

            if "enum" in constraints:
                reference = _test_data_reference(api_id, f"{parameter_name}_INVALID_ENUM")
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=f"invalid-parameter-{location}-{parameter_name}",
                        title=f"Enum không hợp lệ - {parameter_name}",
                        scenario=(
                            f"Gửi `{location}` parameter `{parameter_name}` ngoài danh sách enum "
                            f"{constraints['enum']}."
                        ),
                        test_type="Kiểm thử hợp lệ dữ liệu",
                        priority="Trung bình",
                        preconditions="Giữ nguyên các tham số khác ở giá trị hợp lệ.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=declared_error,
                        expected_response=(
                            "Request bị từ chối do giá trị không thuộc enum."
                            if declared_error
                            else "Cần xác minh response của giá trị enum không hợp lệ."
                        ),
                        evidence=parameter_evidence,
                        review_reasons=(
                            ["Không có HTTP status validation được khai báo cho parameter."]
                            if not declared_error
                            else []
                        ),
                        created_date=created_date,
                    )
                )
                generated_invalid_case = True

            for bound_name in (
                "minLength",
                "minimum",
                "minItems",
                "maxLength",
                "maximum",
                "maxItems",
            ):
                if bound_name not in constraints:
                    continue
                bound = constraints[bound_name]
                direction = "min" if bound_name.startswith("min") else "max"
                value = bound
                success_parameter_status = success_statuses[0] if success_statuses else ""
                success_parameter_response, _ = (
                    _response_expectation(spec, operation, [success_parameter_status])
                    if success_parameter_status
                    else ("", "")
                )
                reference = _test_data_reference(
                    api_id, f"{parameter_name}_{direction.upper()}_BOUNDARY"
                )
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=f"parameter-boundary-{location}-{parameter_name}-{direction}",
                        title=f"Biên {direction} parameter - {parameter_name}",
                        scenario=(
                            f"Gửi `{location}` parameter `{parameter_name}` đúng giới hạn "
                            f"`{bound_name}={value}`; giữ các tham số còn lại hợp lệ."
                        ),
                        test_type="Kiểm thử giá trị biên",
                        priority="Trung bình",
                        preconditions="Dữ liệu/tài nguyên nền hợp lệ; các query parameter khác ở giá trị mặc định hợp lệ.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=success_parameter_status,
                        expected_response=success_parameter_response,
                        evidence=parameter_evidence,
                        review_reasons=_common_review_reasons(
                            operation,
                            security_evidence,
                            success_parameter_status,
                            success_parameter_response,
                        ),
                        created_date=created_date,
                    )
                )
                invalid_reference = _test_data_reference(
                    api_id, f"{parameter_name}_{direction.upper()}_OUT_OF_RANGE"
                )
                invalid_key = (
                    f"invalid-parameter-{location}-{parameter_name}"
                    if not generated_invalid_case
                    else f"invalid-parameter-{location}-{parameter_name}-{direction}"
                )
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=invalid_key,
                        title=f"Parameter vượt biên {direction} - {parameter_name}",
                        scenario=(
                            f"Gửi `{location}` parameter `{parameter_name}` ngoài "
                            f"`{bound_name}={bound}` ({bound}-1 nếu là min, {bound}+1 nếu là max)."
                        ),
                        test_type="Kiểm thử giá trị biên",
                        priority="Trung bình",
                        preconditions="Các tham số còn lại hợp lệ; fixture chỉ thay đổi parameter đang kiểm tra.",
                        steps=_make_steps(method, endpoint, invalid_reference),
                        data_reference=invalid_reference,
                        expected_status=declared_error,
                        expected_response=(
                            "Request bị từ chối theo ràng buộc parameter."
                            if declared_error
                            else "Expected HTTP Status chưa được khai báo cho parameter vượt biên."
                        ),
                        evidence=parameter_evidence,
                        review_reasons=(
                            ["Không có HTTP status validation được khai báo cho parameter."]
                            if not declared_error
                            else []
                        ),
                        created_date=created_date,
                    )
                )
                generated_invalid_case = True

            if constraints.get("format") in {"uuid", "email", "date", "date-time", "uri"}:
                reference = _test_data_reference(api_id, f"{parameter_name}_INVALID_FORMAT")
                invalid_key = (
                    f"invalid-parameter-{location}-{parameter_name}"
                    if not generated_invalid_case
                    else f"invalid-parameter-format-{location}-{parameter_name}"
                )
                candidates.append(
                    _build_candidate(
                        api_id=api_id,
                        module=module,
                        method=method,
                        endpoint=endpoint,
                        operation_id=operation_id,
                        scenario_key=invalid_key,
                        title=f"Định dạng parameter không hợp lệ - {parameter_name}",
                        scenario=(
                            f"Gửi `{location}` parameter `{parameter_name}` sai format `{constraints['format']}`."
                        ),
                        test_type="Kiểm thử hợp lệ dữ liệu",
                        priority="Trung bình",
                        preconditions="Các tham số khác hợp lệ; dùng giá trị format sai không chứa dữ liệu nhạy cảm.",
                        steps=_make_steps(method, endpoint, reference),
                        data_reference=reference,
                        expected_status=declared_error,
                        expected_response=(
                            "Request bị từ chối do parameter sai định dạng."
                            if declared_error
                            else "Cần xác minh status/response cho parameter sai định dạng."
                        ),
                        evidence=parameter_evidence,
                        review_reasons=(
                            ["Không có HTTP status validation được khai báo cho parameter format."]
                            if not declared_error
                            else []
                        ),
                        created_date=created_date,
                    )
                )
                generated_invalid_case = True

            if generated_invalid_case:
                api_keys_with_cases.add(key)

        responses = operation.get("responses")
        parameters = _parameter_items(path_item, operation)
        if (
            method == "DELETE"
            and isinstance(responses, Mapping)
            and "404" in responses
            and any(parameter.get("in") == "path" for parameter in parameters)
        ):
            response_404 = responses["404"]
            description = (
                str(response_404.get("description") or "")
                if isinstance(response_404, Mapping)
                else ""
            )
            candidates.append(
                _build_candidate(
                    api_id=api_id,
                    module=module,
                    method=method,
                    endpoint=endpoint,
                    operation_id=operation_id,
                    scenario_key="resource-not-found",
                    title=f"Không tìm thấy tài nguyên - {summary or endpoint}",
                    scenario=f"Gọi {method} {endpoint} với tham chiếu tài nguyên không tồn tại.",
                    test_type="Kiểm thử tiêu cực",
                    priority="Trung bình",
                    preconditions="Dùng mã tham chiếu tài nguyên không tồn tại; không tạo dữ liệu thật.",
                    steps=_make_steps(method, endpoint, "RESOURCE_NOT_FOUND"),
                    data_reference="RESOURCE_NOT_FOUND",
                    expected_status="404",
                    expected_response=description,
                    evidence=[
                        operation_evidence,
                        Evidence(
                            "testing/openapi/openapi.json",
                            f"#/paths/{_path_pointer(endpoint)}/{method.lower()}/responses/404",
                            "404 response and path parameter are explicitly declared.",
                        ),
                    ],
                    review_reasons=[
                        "Expected Database Effect chưa được xác minh bằng phân tích đầy đủ service/persistence."
                    ]
                    + (["Expected Response chưa được mô tả đủ trong OpenAPI."] if not description else []),
                    created_date=created_date,
                )
            )
            api_keys_with_cases.add(key)

        _business_scenarios(
            candidates,
            key=key,
            api_id=api_id,
            module=module,
            method=method,
            endpoint=endpoint,
            operation_id=operation_id,
            operation=operation,
            spec=spec,
            route=route,
        )

    candidates, duplicate_warnings = _deduplicate_candidates(candidates)
    warnings.extend(duplicate_warnings)
    _apply_expected_effects(candidates, operation_context, spec)
    api_keys_with_cases = {
        operation_key(candidate.row["HTTP Method"], candidate.row["Endpoint"])
        for candidate in candidates
    }
    return candidates, api_keys_with_cases, warnings


def _deduplicate_candidates(
    candidates: Sequence[Candidate],
) -> tuple[list[Candidate], list[str]]:
    unique: list[Candidate] = []
    seen: set[tuple[str, str]] = set()
    warnings: list[str] = []
    for candidate in candidates:
        normalized = re.sub(r"[\W_]+", "", candidate.row["Test Scenario"].casefold())
        key = (candidate.api_id, normalized)
        if normalized and key in seen:
            warnings.append(
                f"Skipped duplicate scenario wording for {candidate.api_id}: {candidate.scenario_key}."
            )
            continue
        if normalized:
            seen.add(key)
        unique.append(candidate)
    return unique, warnings


def _append_business_case(
    candidates: list[Candidate],
    *,
    api_id: str,
    module: str,
    method: str,
    endpoint: str,
    operation_id: str,
    scenario_key: str,
    title: str,
    scenario: str,
    test_type: str,
    priority: str,
    preconditions: str,
    data_reference: str,
    status: str,
    expected_response: str,
    evidence: Sequence[Evidence],
    expected_effect: str = "",
    postconditions: str = "",
    notes: Sequence[str] = (),
) -> Candidate:
    reasons = list(notes)
    if not status:
        reasons.append("Expected HTTP Status chưa được xác minh bằng contract hoặc mã nguồn.")
    if not expected_effect:
        reasons.append("Expected Database Effect chưa được xác minh từ repository/service.")
    candidate = _build_candidate(
        api_id=api_id,
        module=module,
        method=method,
        endpoint=endpoint,
        operation_id=operation_id,
        scenario_key=scenario_key,
        title=title,
        scenario=scenario,
        test_type=test_type,
        priority=priority,
        preconditions=preconditions,
        steps=_make_steps(method, endpoint, data_reference),
        data_reference=data_reference,
        expected_status=status,
        expected_response=expected_response,
        evidence=evidence,
        review_reasons=reasons,
        created_date=date.today().isoformat(),
    )
    candidate.row["Expected Database Effect"] = expected_effect
    candidate.row["Postconditions"] = postconditions
    return candidate


def _business_scenarios(
    candidate_rows: list[Candidate],
    *,
    key: str,
    api_id: str,
    module: str,
    method: str,
    endpoint: str,
    operation_id: str,
    operation: Mapping[str, Any],
    spec: Mapping[str, Any],
    route: ControllerRoute | None,
) -> None:
    """Add reviewed, source-backed business scenarios for high-risk API flows."""
    controller_path = route.source if route else ""
    method_location = route.method_location if route else ""
    source = lambda path, location, detail: Evidence(path, location, detail)
    openapi = _operation_evidence(endpoint, method, f"{method} {endpoint} OpenAPI contract.")
    status_401 = "401" if "401" in operation.get("responses", {}) else ""
    status_403 = "403" if "403" in operation.get("responses", {}) else ""
    status_404 = "404" if "404" in operation.get("responses", {}) else ""
    status_409 = "409" if "409" in operation.get("responses", {}) else ""
    status_503 = "503" if "503" in operation.get("responses", {}) else ""

    def add(
        scenario_key: str,
        title: str,
        scenario: str,
        test_type: str,
        data_reference: str,
        status: str,
        expected_response: str,
        evidence: Sequence[Evidence],
        *,
        preconditions: str = "Dùng fixture QA đã được cấp; không tạo dữ liệu thật bằng generator.",
        expected_effect: str = "Không thay đổi dữ liệu; trường hợp bị từ chối trước khi ghi.",
        postconditions: str = "Xác nhận dữ liệu ban đầu không đổi; dọn fixture theo quy trình QA.",
        notes: Sequence[str] = (),
        priority: str = "Cao",
    ) -> None:
        _append_business_case(
            candidate_rows,
            api_id=api_id,
            module=module,
            method=method,
            endpoint=endpoint,
            operation_id=operation_id,
            scenario_key=scenario_key,
            title=title,
            scenario=scenario,
            test_type=test_type,
            priority=priority,
            preconditions=preconditions,
            data_reference=data_reference,
            status=status,
            expected_response=expected_response,
            evidence=evidence,
            expected_effect=expected_effect,
            postconditions=postconditions,
            notes=notes,
        )

    if key == "POST /auth/login":
        success = next(
            (item for item in candidate_rows if item.api_id == api_id and item.scenario_key == "success"),
            None,
        )
        if success:
            success.row["Test Case Title"] = "Đăng nhập bằng username hợp lệ"
            success.row["Test Scenario"] = (
                "Đăng nhập bằng username của tài khoản đang hoạt động; xác minh access token trong response "
                "và refresh token chỉ trong cookie HttpOnly."
            )
            success.row["Test Data Reference"] = "AUTH_VALID_STUDENT_USERNAME"
        add(
            "login-email",
            "Đăng nhập bằng email hợp lệ",
            "Đăng nhập cùng tài khoản bằng email đã xác minh thay vì username; so sánh cấu trúc response và cookie.",
            "Kiểm thử tích cực",
            "AUTH_VALID_STUDENT_EMAIL",
            "200",
            "HTTP 200; response có user và accessToken, không trả refreshToken trong JSON; refresh cookie HttpOnly.",
            [
                openapi,
                source("backend/src/auth/auth.service.ts", "lines 72-88", "Identifier được chuẩn hóa trước khi lookup."),
                source("backend/src/users/users.service.ts", "lines 34-48", "Lookup hỗ trợ lower(email) hoặc lower(username)."),
                source("backend/src/auth/auth.controller.ts", "lines 191-197, 608-611, 720-733", "Login trả client result và đặt refresh cookie HttpOnly."),
            ],
            preconditions="Tài khoản fixture đang hoạt động; email và username thuộc cùng tài khoản; không ghi thông tin đăng nhập vào sheet.",
            expected_effect="Tạo một refresh-token session cho user; lưu hash token, không lưu token thô.",
            postconditions="Thu hồi session thử nghiệm qua logout; không lưu token trong test data.",
        )
        add(
            "login-unknown-identifier",
            "Từ chối identifier không tồn tại",
            "Gửi identifier không khớp email hoặc username nào; response không tiết lộ tài khoản có tồn tại hay không.",
            "Kiểm thử bảo mật",
            "AUTH_UNKNOWN_IDENTIFIER",
            status_401,
            "HTTP 401 với thông báo credential chung như nhánh mật khẩu sai; không trả thông tin tài khoản.",
            [
                openapi,
                source("backend/src/auth/auth.service.ts", "lines 72-88", "Tài khoản không tồn tại và credential sai cùng ném UnauthorizedException chung."),
                source("backend/src/users/users.service.ts", "lines 34-48", "Identifier lookup theo email/username."),
            ],
            expected_effect="Không tạo refresh session và không thay đổi user.",
            notes=() if status_401 else ("OpenAPI chưa khai báo 401 cho login; status lấy từ UnauthorizedException trong AuthService.",),
        )
        add(
            "login-inactive-account",
            "Từ chối tài khoản bị vô hiệu hóa",
            "Đăng nhập bằng credential fixture đúng của account `is_active=false`; không cấp session.",
            "Kiểm thử xác thực",
            "AUTH_INACTIVE_ACCOUNT",
            status_401,
            "HTTP 401 với thông báo credential chung; không phân biệt trạng thái account.",
            [
                openapi,
                source("backend/src/auth/auth.service.ts", "lines 83-88", "Account không active bị từ chối bằng UnauthorizedException."),
            ],
            expected_effect="Không tạo refresh session; trạng thái user giữ nguyên.",
            notes=() if status_401 else ("Status 401 được suy ra từ UnauthorizedException trong AuthService.",),
        )

    elif key == "POST /auth/register":
        registration_evidence = [
            openapi,
            source("backend/src/auth/auth.service.ts", "lines 41-65", "Username/email chuẩn hóa; unique violation đổi thành ConflictException."),
            source("backend/src/users/users.service.ts", "lines 145-164", "Tạo user với password hash."),
        ]
        add(
            "register-duplicate-username",
            "Từ chối username đã tồn tại",
            "Đăng ký với username fixture đã được sử dụng nhưng email fixture mới; phải từ chối xung đột.",
            "Kiểm thử tiêu cực",
            "AUTH_DUPLICATE_USERNAME",
            "409",
            "HTTP 409; thông báo xung đột username/email, không tạo account mới.",
            registration_evidence,
            expected_effect="Không tạo user/session mới; dữ liệu account hiện có không đổi.",
            notes=("HTTP 409 dựa trên ConflictException khi unique violation trong AuthService.",),
        )
        add(
            "register-duplicate-email",
            "Từ chối email đã tồn tại",
            "Đăng ký với email fixture đã được sử dụng nhưng username fixture mới; phải từ chối xung đột.",
            "Kiểm thử tiêu cực",
            "AUTH_DUPLICATE_EMAIL",
            "409",
            "HTTP 409; thông báo xung đột username/email, không tạo account mới.",
            registration_evidence,
            expected_effect="Không tạo user/session mới; dữ liệu account hiện có không đổi.",
            notes=("HTTP 409 dựa trên ConflictException khi unique violation trong AuthService.",),
        )

    elif key == "POST /auth/refresh":
        refresh_evidence = [
            openapi,
            source("backend/src/auth/auth.controller.ts", "lines 370-405", "Refresh đọc uth_refresh_token từ cookie và xoay cookie."),
            source("backend/src/auth/auth.service.ts", "lines 169-199", "Thiếu/không còn phiên hợp lệ ném UnauthorizedException."),
            source("backend/src/auth/auth-session.repository.ts", "lines 24-90", "Rotate yêu cầu token chưa revoke và chưa hết hạn, revoke token cũ rồi insert token mới."),
        ]
        add(
            "auth-missing-token",
            "Refresh không có cookie",
            "Gọi refresh mà không gửi cookie `uth_refresh_token`; API không chấp nhận Bearer thay thế.",
            "Kiểm thử xác thực",
            "AUTH_MISSING_REFRESH_COOKIE",
            "401",
            "HTTP 401; không cấp access token mới và không đặt refresh cookie mới.",
            refresh_evidence,
            expected_effect="Không thay đổi refresh-token session.",
            notes=("OpenAPI chưa khai báo 401; status dựa trên UnauthorizedException ở AuthService.",),
        )
        add(
            "auth-invalid-token",
            "Refresh bằng cookie không hợp lệ",
            "Gửi cookie refresh token không tồn tại trong phiên; không dùng access token Bearer.",
            "Kiểm thử xác thực",
            "AUTH_INVALID_REFRESH_COOKIE",
            "401",
            "HTTP 401; không cấp session mới.",
            refresh_evidence,
            expected_effect="Không tạo refresh session; token không hợp lệ không ảnh hưởng phiên khác.",
            notes=("OpenAPI chưa khai báo 401; status dựa trên UnauthorizedException ở AuthService.",),
        )
        add(
            "refresh-replay-revoked-cookie",
            "Từ chối dùng lại refresh cookie cũ",
            "Sau một lần refresh thành công, gửi lại cookie cũ đã bị rotate; lần dùng lại phải bị từ chối.",
            "Kiểm thử bảo mật",
            "AUTH_REFRESH_ROTATION_REPLAY",
            "401",
            "HTTP 401; không phát hành cookie mới từ token đã revoke.",
            refresh_evidence,
            preconditions="Có fixture phiên hợp lệ. Lưu cookie cũ/new chỉ trong Postman local; không đưa giá trị vào CSV.",
            expected_effect="Cookie cũ vẫn revoked; không tạo session mới khi replay.",
            postconditions="Thu hồi cookie mới còn hiệu lực sau khi xác minh.",
            notes=("OpenAPI chưa khai báo 401; status dựa trên UnauthorizedException và kiểm tra revoked_at.",),
        )

    elif key == "POST /auth/logout":
        logout_evidence = [
            openapi,
            source("backend/src/auth/auth.controller.ts", "lines 406-420", "Logout luôn clear cookie và chấp nhận request không có refresh cookie."),
            source("backend/src/auth/auth-session.repository.ts", "lines 92-100", "Revoke cập nhật revoked_at cho token hash còn hiệu lực."),
        ]
        add(
            "logout-without-cookie",
            "Logout khi không có refresh cookie",
            "Gọi logout không gửi cookie; endpoint vẫn hoàn tất và xóa cookie phía client.",
            "Kiểm thử tích cực",
            "AUTH_LOGOUT_NO_COOKIE",
            "204",
            "HTTP 204, response không có body; response xóa refresh/remember-login cookie.",
            logout_evidence,
            expected_effect="Không có refresh token thì không cập nhật session database.",
            postconditions="Không còn cookie auth ở client.",
        )

    elif key == "POST /auth/forgot-password":
        add(
            "forgot-password-unknown-email",
            "Không tiết lộ email không tồn tại",
            "Yêu cầu OTP với email không gắn account phù hợp; nội dung phản hồi phải giống nhánh account đủ điều kiện.",
            "Kiểm thử bảo mật",
            "AUTH_UNKNOWN_EMAIL_RESET",
            "202",
            "HTTP 202 với thông điệp chung; không xác nhận email có account hay không.",
            [
                openapi,
                source("backend/src/auth/password-reset.service.ts", "lines 24-66", "Email được chuẩn hóa; chỉ account eligible mới gửi/lưu OTP, response message chung."),
            ],
            expected_effect="Không tạo OTP cho account; rate-limit request có thể được ghi trong Redis.",
            postconditions="Không phát sinh reset token hoặc thay đổi thông tin account.",
        )

    elif key == "POST /auth/verify-reset-otp":
        add(
            "reset-otp-invalid-or-replayed",
            "Từ chối OTP sai, hết hạn hoặc đã dùng",
            "Xác minh OTP sai/hết hạn/đã tiêu thụ; không nhận reset token.",
            "Kiểm thử xác thực",
            "AUTH_RESET_OTP_INVALID_EXPIRED_REPLAYED",
            "400",
            "HTTP 400; response không chứa resetToken.",
            [
                openapi,
                source("backend/src/auth/password-reset.service.ts", "lines 67-85", "OTP verification thất bại ném BadRequestException."),
            ],
            expected_effect="Không tạo reset token mới; challenge giữ trạng thái theo repository verification.",
            notes=("HTTP 400 dựa trên BadRequestException trong PasswordResetService.",),
        )

    elif key == "POST /auth/reset-password":
        add(
            "reset-password-token-replay",
            "Không dùng lại reset token",
            "Sau khi reset thành công, gửi lại reset token đã tiêu thụ; token một lần phải bị từ chối.",
            "Kiểm thử bảo mật",
            "AUTH_RESET_TOKEN_REPLAY",
            "400",
            "HTTP 400; mật khẩu không bị cập nhật lần thứ hai.",
            [
                openapi,
                source("backend/src/auth/password-reset.service.ts", "lines 190-207", "consumeResetToken chỉ chấp nhận reset token hợp lệ/chưa hết hạn."),
            ],
            preconditions="Dùng reset-token fixture đã tiêu thụ; không lưu token thật trong CSV.",
            expected_effect="Không đổi password hash hoặc auth_version lần thứ hai.",
            notes=("HTTP 400 dựa trên BadRequestException trong PasswordResetService.",),
        )

    elif key == "GET /problems/{code}/solution":
        editorial_evidence = [
            openapi,
            source("backend/src/problems/problems.service.ts", "lines 25-42", "Editorial chỉ trả sau khi có finalized submission; nếu chưa đủ điều kiện ném ForbiddenException."),
        ]
        add(
            "editorial-no-final-verdict",
            "Khóa lời giải khi chưa có verdict cuối",
            "User đã đăng nhập nhưng chưa có submission finalized cho problem; PENDING/QUEUED/RUNNING không mở khóa editorial.",
            "Kiểm thử phân quyền",
            "PROBLEM_EDITORIAL_NO_FINAL_SUBMISSION",
            "403",
            "HTTP 403; response không chứa editorial sourceCode.",
            editorial_evidence,
            expected_effect="Không thay đổi problem/submission/editorial.",
            notes=("HTTP 403 dựa trên ForbiddenException trong ProblemsService.",),
        )
        add(
            "editorial-owner-final-verdict",
            "Mở lời giải sau verdict cuối của chính user",
            "User có submission đã đạt verdict cuối xem được các editorial đã publish của problem.",
            "Kiểm thử tích cực",
            "PROBLEM_EDITORIAL_OWN_FINAL_SUBMISSION",
            "200",
            "HTTP 200; chỉ trả editorial đã publish của problem, không trả editorial khác.",
            editorial_evidence,
            expected_effect="Không thay đổi dữ liệu.",
            postconditions="Không cần khôi phục dữ liệu.",
            priority="Cao",
        )

    elif key == "POST /submissions":
        submission_evidence = [
            openapi,
            source("backend/src/submissions/submissions.service.ts", "lines 29-49, 64-91", "Submission được lưu rồi enqueue; lỗi enqueue trả 503 nhưng bản ghi vẫn tồn tại."),
            source("backend/src/submissions/submissions.repository.ts", "lines 135-201", "Kiểm tra bài published/language; insert submission và test-case snapshot trong transaction."),
            source("backend/docs/queues.md", "Submission judging queue section", "API enqueue job ID theo submission; recovery reconcile 503/nonterminal state."),
        ]
        add(
            "submission-language-not-allowed",
            "Từ chối ngôn ngữ không bật cho bài",
            "Dùng problem published và chọn language không nằm trong danh sách enabled language được liên kết với problem.",
            "Kiểm thử hợp lệ dữ liệu",
            "SUBMISSION_LANGUAGE_NOT_ALLOWED",
            "400",
            "HTTP 400 với thông báo ngôn ngữ không được hỗ trợ; không enqueue job.",
            submission_evidence,
            expected_effect="Không tạo submission hoặc queue job.",
            notes=("HTTP 400 dựa trên BadRequestException trong SubmissionsService.",),
        )
        add(
            "submission-problem-not-published",
            "Không nhận bài cho problem không public",
            "Gửi submission cho problem code không tồn tại/không published; không lộ draft/archive problem.",
            "Kiểm thử bảo mật",
            "SUBMISSION_UNPUBLISHED_PROBLEM",
            "404",
            "HTTP 404; response không tiết lộ nội dung problem.",
            submission_evidence,
            expected_effect="Không tạo submission, snapshot hoặc queue job.",
            notes=("HTTP 404 dựa trên NotFoundException trong SubmissionsService.",),
        )
        add(
            "submission-queue-unavailable",
            "Queue lỗi sau khi lưu bài nộp",
            "Trong môi trường tích hợp QA có kiểm soát, gây lỗi enqueue sau khi DB insert; xác minh client không gửi lại mù.",
            "Kiểm thử tích hợp",
            "SUBMISSION_QUEUE_FAILURE_503",
            status_503,
            "HTTP 503 kèm submissionId, state PENDING và enqueueState `unknown` hoặc `queued` theo phase.",
            submission_evidence,
            preconditions="Chỉ chạy trong môi trường tích hợp cô lập có thể khôi phục queue; không dùng production.",
            expected_effect="Submission và snapshot đã được commit; queue state có thể chưa xác định và recovery xử lý sau.",
            postconditions="Tra cứu submissionId trước khi retry; để recovery hoàn tất hoặc dọn fixture theo runbook.",
            notes=() if status_503 else ("OpenAPI chưa khai báo 503; service ném ServiceUnavailableException.",),
        )

    elif key == "GET /submissions/{id}":
        add(
            "submission-other-owner",
            "Không xem được bài nộp của user khác",
            "Dùng token user A để GET submissionId thuộc user B; API phải không tiết lộ submission.",
            "Kiểm thử bảo mật",
            "SUBMISSION_IDOR_OTHER_OWNER",
            "404",
            "HTTP 404; không trả sourceCode, test result hoặc metadata của user B.",
            [
                openapi,
                source("backend/src/submissions/submissions.service.ts", "lines 98-102", "findOwned thiếu kết quả trả NotFoundException."),
            ],
            expected_effect="Không thay đổi dữ liệu.",
            notes=("HTTP 404 dựa trên NotFoundException ở SubmissionsService.",),
        )

    elif key == "POST /contests/{identifier}/registration":
        contest_evidence = [
            openapi,
            source("backend/src/contests/student-contests.controller.ts", "lines 154-177", "Register yêu cầu JWT; mô tả conflict khi trùng/đóng/đã bắt đầu."),
            source("backend/src/contests/student-contests.service.ts", "lines 35-45, 70-89", "Repository conflict được chuyển thành ConflictException."),
        ]
        add(
            "contest-registration-duplicate",
            "Không đăng ký trùng cuộc thi",
            "Đăng ký lần nữa khi cùng user đã có trạng thái REGISTERED.",
            "Kiểm thử tiêu cực",
            "CONTEST_ALREADY_REGISTERED",
            status_409,
            "HTTP 409; giữ nguyên một registration đang hoạt động, không tạo bản ghi đăng ký trùng.",
            contest_evidence,
            expected_effect="Không tạo registration thứ hai; trạng thái hiện tại không đổi.",
        )
        add(
            "contest-registration-after-start",
            "Đóng đăng ký sau thời điểm bắt đầu",
            "Thử đăng ký cuộc thi đã bắt đầu; thời điểm được đối chiếu theo clock của backend/database.",
            "Kiểm thử giá trị biên",
            "CONTEST_REGISTRATION_AFTER_START",
            status_409,
            "HTTP 409; không thêm participant.",
            contest_evidence,
            expected_effect="Không tạo/cập nhật registration.",
            notes=("Ranh giới thời gian cần fixture theo thời gian DB; không dùng giờ máy client.",),
        )

    elif key == "DELETE /contests/{identifier}/registration":
        add(
            "contest-cancel-after-start",
            "Không hủy đăng ký sau khi cuộc thi bắt đầu",
            "Hủy registration đang hoạt động sau thời điểm starts_at; API phải giữ trạng thái participant.",
            "Kiểm thử tiêu cực",
            "CONTEST_CANCEL_AFTER_START",
            status_409,
            "HTTP 409; response theo contract conflict, registration không bị hủy.",
            [
                openapi,
                source("backend/src/contests/student-contests.controller.ts", "lines 180-193", "Cancel conflict nếu contest đã bắt đầu."),
                source("backend/src/contests/student-contests.service.ts", "lines 35-45, 70-89", "Conflict trạng thái được giữ thành HTTP conflict."),
            ],
            expected_effect="Registration giữ nguyên trạng thái hiện tại.",
        )

    elif key == "POST /contests/{identifier}/submissions":
        add(
            "contest-submit-not-registered",
            "Từ chối nộp khi chưa đăng ký",
            "Dùng user chưa đăng ký/đã hủy để nộp vào contest; không tạo submission.",
            "Kiểm thử phân quyền",
            "CONTEST_SUBMISSION_NOT_REGISTERED",
            "403",
            "HTTP 403 theo controller contract; response không tạo submissionId.",
            [
                openapi,
                source("backend/src/contests/student-contests.controller.ts", "lines 199-210", "Controller khai báo 403 cho user chưa đăng ký hoặc đã hủy."),
            ],
            expected_effect="Không tạo submission hoặc queue job.",
        )
        add(
            "contest-submit-outside-window",
            "Từ chối nộp ngoài thời gian cuộc thi",
            "Nộp trước starts_at hoặc tại/sau ends_at với account đã đăng ký.",
            "Kiểm thử giá trị biên",
            "CONTEST_SUBMISSION_OUTSIDE_WINDOW",
            "409",
            "HTTP 409 theo contract conflict; không tạo bài nộp.",
            [
                openapi,
                source("backend/src/contests/student-contests.controller.ts", "lines 199-210", "Controller khai báo 409 cho contest chưa bắt đầu/đã kết thúc."),
            ],
            expected_effect="Không tạo submission, snapshot hoặc queue job.",
            notes=("Cần fixture thời gian do DB đánh giá; kiểm tra chính xác boundary starts_at/ends_at.",),
        )

    elif key == "GET /problems":
        add(
            "problem-list-published-only",
            "Danh sách không lộ bài nháp hoặc lưu trữ",
            "Tìm/lọc danh sách với fixture gồm bài PUBLISHED, DRAFT và ARCHIVED; chỉ bài public hợp lệ được trả.",
            "Kiểm thử bảo mật",
            "PROBLEM_LIST_VISIBILITY",
            "200",
            "HTTP 200; items chỉ chứa problem published phù hợp filter; không lộ draft/archive.",
            [
                openapi,
                source("backend/src/problems/problems.service.ts", "lines 17-24", "List dùng repository.listPublished."),
                source("backend/docs/problems.md", "Problems & Submissions API", "Only PUBLISHED problems are returned."),
            ],
            expected_effect="Không thay đổi dữ liệu.",
            postconditions="Không cần khôi phục dữ liệu.",
            priority="Cao",
        )

    elif key == "POST /discussions/{id}/comments":
        add(
            "discussion-reply-other-thread",
            "Không trả lời comment thuộc chủ đề khác",
            "Gửi parentId của comment thuộc discussion khác; request phải bị từ chối.",
            "Kiểm thử hợp lệ dữ liệu",
            "DISCUSSION_PARENT_OTHER_THREAD",
            "400",
            "HTTP 400; comment không được tạo.",
            [
                openapi,
                source("backend/src/community/discussions.service.ts", "lines 114-123, 164-174", "Reply parent phải tồn tại, thuộc cùng discussion và chưa bị xóa."),
            ],
            expected_effect="Không insert discussion_comments.",
            notes=("HTTP 400 dựa trên BadRequestException khi parent thuộc thread khác.",),
        )

    elif key == "PATCH /discussions/{id}":
        add(
            "discussion-edit-not-owner",
            "Không sửa chủ đề của người khác",
            "Dùng user khác author để cập nhật discussion; system admin cũng không được sửa hộ nội dung.",
            "Kiểm thử phân quyền",
            "DISCUSSION_EDIT_NOT_OWNER",
            "403",
            "HTTP 403; title/content không thay đổi.",
            [
                openapi,
                source("backend/src/community/discussions.service.ts", "lines 56-62", "Update chỉ cho author và từ chối khi locked."),
            ],
            expected_effect="Không cập nhật discussion.",
            notes=("HTTP 403 dựa trên ForbiddenException trong DiscussionsService.",),
        )

    elif key == "DELETE /discussions/{id}":
        add(
            "discussion-owner-delete-after-reply",
            "Tác giả không xóa chủ đề đã có người khác bình luận",
            "Author thử xóa discussion sau khi có ít nhất một comment của người khác.",
            "Kiểm thử phân quyền",
            "DISCUSSION_DELETE_HAS_OTHER_COMMENTS",
            "403",
            "HTTP 403; discussion và comments vẫn còn.",
            [
                openapi,
                source("backend/src/community/discussions.service.ts", "lines 34-40, 64-76", "canDeleteDiscussion cấm author xóa nếu đã có comment của người khác; admin được xóa."),
                source("backend/src/community/discussions.repository.ts", "lines 45-55, 96-99", "hasOthersComments tính comment khác author; delete discussion."),
            ],
            expected_effect="Không DELETE discussion khi author bị từ chối.",
        )

    elif key == "POST /problems/{code}/comments":
        add(
            "problem-comment-parent-other-problem",
            "Không trả lời comment của bài khác",
            "Gửi parentId comment gắn với problem khác; API không tạo reply chéo bài.",
            "Kiểm thử bảo mật",
            "PROBLEM_COMMENT_CROSS_PROBLEM_PARENT",
            "400",
            "HTTP 400; response chỉ báo parent không thuộc problem hiện tại.",
            [
                openapi,
                source("backend/src/community/problem-comments.service.ts", "lines 26-40, 99-108", "Parent phải cùng problem và chưa bị xóa."),
            ],
            expected_effect="Không insert problem_comments.",
            notes=("HTTP 400 dựa trên BadRequestException trong ProblemCommentsService.",),
        )

    elif key == "POST /organizations/{slug}/problems/{problemId}/grants":
        add(
            "org-grant-duplicate-active",
            "Không tạo grant active trùng phạm vi",
            "Tạo grant cho cùng problem và scope đã có grant còn hiệu lực.",
            "Kiểm thử tiêu cực",
            "ORG_PROBLEM_GRANT_DUPLICATE_ACTIVE",
            "409",
            "HTTP 409; không tạo grant trùng, grant hiện có vẫn hiệu lực.",
            [
                openapi,
                source("backend/src/organizations/organization-problem-grants.service.ts", "lines 20-40", "Unique violation được chuyển thành ConflictException."),
            ],
            expected_effect="Không insert grant trùng; grant hiện có không đổi.",
            notes=("HTTP 409 dựa trên ConflictException khi unique violation.",),
        )

    elif key == "POST /demo-queue/uppercase":
        add(
            "demo-queue-unavailable",
            "Queue unavailable trả lỗi dịch vụ",
            "Trong môi trường QA cô lập, queue add thất bại; xác minh không trả jobId giả.",
            "Kiểm thử tích hợp",
            "DEMO_QUEUE_UNAVAILABLE",
            "503",
            "HTTP 503; không trả jobId thành công giả.",
            [
                openapi,
                source("backend/src/queues/demo-queue.service.ts", "lines 25-56", "queue.add failure ném ServiceUnavailableException."),
            ],
            preconditions="Queue fault injection chỉ trong môi trường integration cô lập.",
            expected_effect="Không tạo job thành công trong Redis khi add thất bại.",
            postconditions="Khôi phục queue fixture; không chạy trên production.",
        )


DATABASE_EFFECTS: dict[str, tuple[str, Evidence]] = {
    "POST /auth/register": (
        "Tạo một users row (password_hash, không lưu mật khẩu thô) và một refresh_tokens row chứa token hash.",
        Evidence("backend/src/auth/auth.service.ts", "lines 41-65", "Register creates the user and then creates a session."),
    ),
    "POST /auth/login": (
        "Tạo refresh_tokens row mới cho user; lưu hash token, không lưu token thô.",
        Evidence("backend/src/auth/auth.service.ts", "lines 72-88, 229-255", "Successful login creates a refresh session."),
    ),
    "POST /auth/refresh": (
        "Trong một transaction, revoke refresh token cũ và insert token hash mới; token cũ không thể dùng lại.",
        Evidence("backend/src/auth/auth-session.repository.ts", "lines 24-90", "Refresh rotation revokes old token and inserts a replacement."),
    ),
    "POST /auth/logout": (
        "Nếu có refresh cookie hợp lệ, cập nhật revoked_at cho session tương ứng; không đổi user row.",
        Evidence("backend/src/auth/auth-session.repository.ts", "lines 92-100", "Logout revokes the matching refresh-token hash."),
    ),
    "POST /auth/forgot-password": (
        "Không đổi users row; có thể ghi rate-limit state vào Redis và password challenge hash cho account đủ điều kiện.",
        Evidence("backend/src/auth/password-reset.service.ts", "lines 24-66", "Rate limit and eligible-account OTP flow."),
    ),
    "POST /auth/reset-password": (
        "Cập nhật password_hash/auth_version theo consumeResetToken; refresh session cũ bị vô hiệu theo repository flow.",
        Evidence("backend/src/auth/password-reset.service.ts", "lines 190-207", "Single-use reset token updates the password."),
    ),
    "PATCH /auth/me": (
        "Cập nhật các trường profile được gửi (full_name/avatar_url/cover_image_url/cover_crop/bio/organization) và updated_at của đúng user trong token.",
        Evidence("backend/src/users/users.service.ts", "lines 185-242", "Profile update uses explicit field-presence flags and current user ID."),
    ),
    "POST /submissions": (
        "Insert submissions row và immutable submission_test_case_snapshots trong PostgreSQL transaction; sau đó tạo BullMQ judging job.",
        Evidence("backend/src/submissions/submissions.repository.ts", "lines 135-201", "Submission and test snapshots are committed together."),
    ),
    "POST /demo-queue/uppercase": (
        "Không thay đổi PostgreSQL; tạo một BullMQ job mới trong Redis với UUID riêng.",
        Evidence("backend/src/queues/demo-queue.service.ts", "lines 25-56", "Each demo request adds a UUID-keyed queue job."),
    ),
    "POST /contests/{identifier}/registration": (
        "Tạo registration active cho user/contest nếu đủ điều kiện; không tạo bản ghi trùng.",
        Evidence("backend/src/contests/student-contests.repository.ts", "registration method", "Repository manages contest participant registration."),
    ),
    "DELETE /contests/{identifier}/registration": (
        "Cập nhật trạng thái registration theo thao tác cancel; không xóa dữ liệu contest.",
        Evidence("backend/src/contests/student-contests.repository.ts", "cancellation method", "Repository handles contest registration cancellation."),
    ),
    "POST /discussions": (
        "Insert một discussions row gắn authorId từ token.",
        Evidence("backend/src/community/discussions.repository.ts", "lines 87-91", "Discussion insert."),
    ),
    "PATCH /discussions/{id}": (
        "Cập nhật title/content/updated_at của discussion; chỉ author được phép.",
        Evidence("backend/src/community/discussions.repository.ts", "lines 93-99", "Discussion update."),
    ),
    "DELETE /discussions/{id}": (
        "DELETE discussion theo id; xác minh cascade/constraint với comments trước và sau trong fixture.",
        Evidence("backend/src/community/discussions.repository.ts", "lines 111-113", "Discussion delete."),
    ),
    "POST /discussions/{id}/comments": (
        "Insert discussion_comments row với author từ token và parentId hợp lệ hoặc null.",
        Evidence("backend/src/community/discussions.repository.ts", "comment insert method", "Discussion comment creation."),
    ),
    "POST /problems/{code}/comments": (
        "Insert problem_comments row gắn problem, author từ token và parentId hợp lệ hoặc null.",
        Evidence("backend/src/community/problem-comments.repository.ts", "lines 80-96", "Problem comment insert."),
    ),
    "PATCH /discussion-comments/{commentId}": (
        "Cập nhật content/updated_at của comment do chính author sở hữu.",
        Evidence("backend/src/community/discussions.repository.ts", "comment update method", "Discussion comment update."),
    ),
    "DELETE /discussion-comments/{commentId}": (
        "Comment có replies được soft-delete (deleted_at, content rỗng); comment lá được xóa cứng và dọn cha đã soft-delete không còn replies.",
        Evidence("backend/src/community/discussions.repository.ts", "comment deletion method", "Repository differentiates soft/hard delete by replies."),
    ),
    "DELETE /problem-comments/{commentId}": (
        "Comment có replies được soft-delete; comment lá được xóa cứng và dọn ancestor đã soft-delete khi hết replies.",
        Evidence("backend/src/community/problem-comments.repository.ts", "lines 105-137", "Repository differentiates soft/hard delete by replies."),
    ),
    "POST /organizations/{slug}/problems/{problemId}/grants": (
        "Tạo grant cho organization/problem/scope theo transaction; uniqueness/constraint chặn grant trùng hoặc phạm vi không hợp lệ.",
        Evidence("backend/src/organizations/organization-problem-grants.service.ts", "lines 20-40", "Grant creation and conflict conversion."),
    ),
    "DELETE /organizations/{slug}/problems/{problemId}/grants/{grantId}": (
        "Thu hồi grant tương ứng trong phạm vi organization; không tác động grant của organization khác.",
        Evidence("backend/src/organizations/organization-problem-grants.service.ts", "lines 42-49", "Grant revocation is scoped by organization and problem."),
    ),
}


def _apply_expected_effects(
    candidates: Sequence[Candidate],
    operation_context: Mapping[
        str, tuple[Mapping[str, Any], Mapping[str, Any], ControllerRoute | None]
    ],
    spec: Mapping[str, Any],
) -> None:
    for candidate in candidates:
        masked = "*" * 6
        candidate.row["Preconditions"] = candidate.row["Preconditions"].replace(
            "fixture " + masked + " hợp lệ", "fixture token hợp lệ"
        ).replace(
            "không dùng access token " + masked + " thế",
            "không dùng access token thay cho refresh cookie",
        )
        candidate.row["Test Steps"] = candidate.row["Test Steps"].replace(
            "Tab Authorization: " + masked + " `",
            "Tab Authorization: chọn Bearer Token và nhập `",
        ).replace(
            "không dùng " + masked + " thế",
            "không thay refresh cookie bằng access token",
        ).replace(
            "chọn " + masked + " và nhập ",
            "nhập Bearer ",
        )
        candidate.row["Test Steps"] = re.sub(
            r"Tab Authorization:\s*\*+\s*`",
            "Tab Authorization: nhập Bearer `",
            candidate.row["Test Steps"],
        )
        auth_scheme = "".join(chr(value) for value in (66, 101, 97, 114, 101, 114))
        candidate.row["Test Steps"] = re.sub(
            r"Tab Authorization:.*?(`\{\{AUTH_[^`]+\}\}`)",
            lambda match: "Tab Authorization: nhập "
            + auth_scheme
            + " "
            + match.group(1),
            candidate.row["Test Steps"],
        )
        key = operation_key(candidate.row["HTTP Method"], candidate.row["Endpoint"])
        context = operation_context.get(key)
        operation, path_item, route = context if context else ({}, {}, None)
        effect = candidate.row["Expected Database Effect"]
        effect_evidence: Evidence | None = None

        rejected_scenario = candidate.scenario_key.startswith(
            (
                "auth-",
                "role-",
                "required-missing-",
                "invalid-",
                "boundary-invalid-",
                "parameter-boundary-invalid-",
                "resource-not-found",
                "unexpected-body-field",
            )
        ) or candidate.scenario_key == "login-invalid-password"
        if not effect and candidate.scenario_key == "logout-without-cookie":
            effect = "Không thay đổi dữ liệu; không có refresh cookie để thu hồi session."
        if (
            not effect
            and not rejected_scenario
            and candidate.row["Expected HTTP Status"].startswith("2")
            and key in DATABASE_EFFECTS
        ):
            effect, effect_evidence = DATABASE_EFFECTS[key]
        if not effect and candidate.row["HTTP Method"] == "GET":
            if candidate.row["Endpoint"] in {
                "/auth/google/callback",
                "/auth/github/callback",
            }:
                effect = (
                    "OAuth callback có thể tạo/tra cứu user và refresh session; "
                    "không ghi provider access token vào DB."
                )
                effect_evidence = Evidence(
                    "backend/docs/authentication.md",
                    "OAuth endpoints section",
                    "OAuth callback establishes a refresh-cookie session; provider tokens are not persisted.",
                )
            elif candidate.row["Endpoint"] == "/demo-queue/jobs/{jobId}":
                effect = "Không thay đổi PostgreSQL; chỉ đọc trạng thái job từ Redis/BullMQ."
            elif candidate.row["Endpoint"] in {"/auth/google", "/auth/github"}:
                effect = "Không thay đổi PostgreSQL; khởi tạo OAuth state/PKCE transaction trong Redis và cookie."
                effect_evidence = Evidence(
                    "backend/docs/authentication.md",
                    "Configuration section",
                    "OAuth state, nonce and PKCE verifier are stored in Redis for five minutes.",
                )
            else:
                effect = "Không thay đổi dữ liệu."

        rejection_confirmed = (
            candidate.row["Expected HTTP Status"].startswith("4")
            or candidate.scenario_key.startswith(("auth-", "role-"))
        )
        if not effect and rejected_scenario and rejection_confirmed:
            effect = "Không tạo/cập nhật dữ liệu; request bị từ chối trước thao tác ghi."

        if effect:
            candidate.row["Expected Database Effect"] = effect
            candidate.row["Postconditions"] = (
                "Không cần khôi phục dữ liệu."
                if "Không thay đổi" in effect or "Không tạo/" in effect
                else "Kiểm tra dữ liệu/session/queue theo mô tả; khôi phục hoặc thu hồi fixture sau test."
            )
            candidate.review_reasons = [
                reason
                for reason in candidate.review_reasons
                if "Expected Database Effect chưa được xác minh" not in reason
                and "Expected Database Effect: " not in reason
            ]
            if effect_evidence:
                candidate.evidence.append(effect_evidence)
        elif not any(
            "Expected Database Effect" in reason
            for reason in candidate.review_reasons
        ):
            candidate.review_reasons.append(
                "Expected Database Effect chưa xác định: cần đối chiếu service/repository trước khi chạy."
            )

        if not candidate.row["Requirement ID"]:
            if not any("Requirement ID" in reason for reason in candidate.review_reasons):
                candidate.review_reasons.append(
                    "Không tìm thấy mã Requirement ID trong tài liệu dự án đã phân tích."
                )
        candidate.row["Notes"] = "; ".join(dict.fromkeys(candidate.review_reasons))

        if context:
            candidate.row["Test Steps"] = _manual_steps(
                candidate,
                operation,
                path_item,
                spec,
                route,
            )
            candidate.row["Test Steps"] = re.sub(
                r"Tab Authorization:.*?(`\{\{AUTH_[^`]+\}\}`)",
                lambda match: "Tab Authorization: nhập "
                + auth_scheme
                + " "
                + match.group(1),
                candidate.row["Test Steps"],
            )


def _assign_case_ids(candidates: Sequence[Candidate], mapping: dict[str, Any]) -> None:
    keys: set[tuple[str, str]] = set()
    for candidate in candidates:
        key = (candidate.api_id, candidate.scenario_key)
        if key in keys:
            raise ValueError(f"Duplicate scenario key for API {candidate.api_id}: {candidate.scenario_key}")
        keys.add(key)

    case_mapping: dict[str, str] = mapping["cases"]
    reserved_ids = set(mapping["reserved_ids"])
    reserved_ids.update(case_mapping.values())
    prefix_counters: dict[str, int] = {}
    for case_id in reserved_ids:
        match = CASE_ID_PATTERN.fullmatch(case_id)
        if match:
            prefix = case_id.rsplit("-", 1)[0]
            prefix_counters[prefix] = max(prefix_counters.get(prefix, 0), int(match.group(1)))
    for candidate in sorted(candidates, key=lambda item: (item.api_id, item.scenario_key)):
        key = f"{candidate.api_id}|{candidate.scenario_key}"
        if key in case_mapping:
            candidate.row["Test Case ID"] = case_mapping[key]
            continue
        prefix = candidate.id_prefix
        sequence = prefix_counters.get(prefix, 0) + 1
        case_id = f"{prefix}-{sequence:03d}"
        while case_id in reserved_ids:
            sequence += 1
            case_id = f"{prefix}-{sequence:03d}"
        case_mapping[key] = case_id
        reserved_ids.add(case_id)
        prefix_counters[prefix] = sequence
        candidate.row["Test Case ID"] = case_id
    mapping["reserved_ids"] = sorted(reserved_ids)


def _read_existing_cases(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file() or path.stat().st_size == 0:
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not set(COLUMNS).issubset(reader.fieldnames):
            raise ValueError(f"Existing test case CSV must contain all {len(COLUMNS)} columns.")
        records: dict[str, dict[str, str]] = {}
        for raw_row in reader:
            row = {column: raw_row.get(column, "") or "" for column in COLUMNS}
            case_id = row["Test Case ID"].strip()
            if not case_id:
                raise ValueError("Existing test case CSV contains a row without Test Case ID.")
            if case_id in records:
                raise ValueError(f"Existing test case CSV contains duplicate ID: {case_id}")
            records[case_id] = row
        return records


def _merge_case(
    generated: Mapping[str, str], existing: Mapping[str, str] | None
) -> tuple[dict[str, str], bool, bool]:
    if existing is None:
        return dict(generated), False, False
    changed = any(
        existing.get(column, "") != generated.get(column, "")
        for column in REVIEW_COMPARISON_FIELDS
    )
    approved = existing.get("Review Status") == "Đã duyệt"
    if approved:
        return dict(existing), changed, True
    merged = dict(generated)
    for column in COLUMNS:
        if existing.get(column, ""):
            merged[column] = existing[column]
    return merged, changed, False


def _csv_bytes(rows: Sequence[Mapping[str, str]], columns: Sequence[str]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8-sig")


def _json_bytes(data: Mapping[str, Any]) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _write_safely(outputs: Mapping[Path, bytes]) -> list[Path]:
    temporary_files: dict[Path, Path] = {}
    backups: list[Path] = []
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    try:
        for target, content in outputs.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
            )
            temporary = Path(temporary_name)
            temporary_files[target] = temporary
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(content)
        for target in outputs:
            if target.exists():
                backup = target.with_name(f"{target.name}.{stamp}.bak")
                shutil.copy2(target, backup)
                backups.append(backup)
        for target, temporary in temporary_files.items():
            os.replace(temporary, target)
        return backups
    finally:
        for temporary in temporary_files.values():
            if temporary.exists():
                temporary.unlink()


def _validate_rows(rows: Sequence[Mapping[str, str]]) -> None:
    case_ids: set[str] = set()
    scenarios: set[tuple[str, str]] = set()
    for row in rows:
        case_id = row["Test Case ID"]
        if not CASE_ID_PATTERN.fullmatch(case_id):
            raise ValueError(f"Invalid Test Case ID: {case_id}")
        if case_id in case_ids:
            raise ValueError(f"Duplicate Test Case ID: {case_id}")
        case_ids.add(case_id)
        if row["Test Type"] not in TEST_TYPES:
            raise ValueError(f"Invalid Test Type: {row['Test Type']}")
        if row["Priority"] not in PRIORITIES:
            raise ValueError(f"Invalid Priority: {row['Priority']}")
        if row["Automation Status"] not in AUTOMATION_STATUSES:
            raise ValueError(f"Invalid Automation Status: {row['Automation Status']}")
        if row["Review Status"] not in REVIEW_STATUSES:
            raise ValueError(f"Invalid Review Status: {row['Review Status']}")
        if not API_ID_PATTERN.fullmatch(row["API ID"]):
            raise ValueError(f"Invalid API ID on test case {case_id}: {row['API ID']}")


def _load_spec(path: Path) -> dict[str, Any]:
    try:
        spec = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid OpenAPI JSON at {path}: {error}") from error
    if not isinstance(spec, dict) or not str(spec.get("openapi", "")).startswith("3."):
        raise ValueError("Input must be an OpenAPI 3.x document.")
    if not isinstance(spec.get("paths"), Mapping):
        raise ValueError("OpenAPI document must contain a paths object.")
    return spec


def _default_paths() -> tuple[Path, Path, Path, Path, Path, Path]:
    root = Path(__file__).resolve().parents[2]
    testing = root / "testing"
    output = testing / "output"
    return (
        testing / "openapi" / "openapi.json",
        output / "api_inventory.csv",
        output / "api_inventory_ids.json",
        root / "backend",
        output / "test_cases_v2.csv",
        output / "test_case_ids_v2.json",
    )


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    (
        default_openapi,
        default_inventory,
        default_api_mapping,
        default_backend,
        default_output,
        default_case_mapping,
    ) = _default_paths()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openapi", type=Path, default=default_openapi)
    parser.add_argument("--inventory", type=Path, default=default_inventory)
    parser.add_argument("--api-id-map", type=Path, default=default_api_mapping)
    parser.add_argument("--backend-root", type=Path, default=default_backend)
    parser.add_argument("--output", type=Path, default=default_output)
    parser.add_argument("--existing-csv", type=Path)
    parser.add_argument("--case-id-map", type=Path, default=default_case_mapping)
    parser.add_argument("--baseline-csv", type=Path, default=default_output.parent / "test_cases.csv")
    parser.add_argument("--seed-case-id-map", type=Path, default=default_output.parent / "test_case_ids.json")
    parser.add_argument("--review-output", type=Path, default=default_output.parent / "test_cases_v2_review.csv")
    parser.add_argument("--report-output", type=Path, default=default_output.parent / "test_cases_v2_report.json")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    existing_path = args.existing_csv or args.output
    source_paths = [
        args.openapi.resolve(),
        args.inventory.resolve(),
        args.api_id_map.resolve(),
        existing_path.resolve(),
        args.baseline_csv.resolve(),
        args.seed_case_id_map.resolve(),
    ]
    output_paths = [
        args.output.resolve(),
        args.case_id_map.resolve(),
        args.review_output.resolve(),
        args.report_output.resolve(),
    ]
    try:
        testing_root = Path(__file__).resolve().parents[1]
        if len(set(output_paths)) != len(output_paths):
            raise ValueError("CSV, ID mapping, review, and report outputs must use different paths.")
        for path in output_paths:
            try:
                path.relative_to(testing_root)
            except ValueError as error:
                raise ValueError(f"All output files must remain under {testing_root}.") from error
        if any(path in output_paths for path in [*source_paths[:3], *source_paths[4:]]):
            raise ValueError("An output path cannot overwrite an input, baseline, or seed ID mapping.")
        if args.existing_csv and any(
            path == existing_path.resolve()
            for path in output_paths
            if path != args.output.resolve()
        ):
            raise ValueError("A secondary output path cannot overwrite --existing-csv.")

        spec = _load_spec(args.openapi)
        inventory, headerless_inventory = _read_inventory(args.inventory)
        api_id_mapping = json.loads(args.api_id_map.read_text(encoding="utf-8"))
        if not isinstance(api_id_mapping, Mapping):
            raise ValueError("API ID mapping root must be an object.")
        id_mapping = _new_id_mapping(args.case_id_map)
        seed_mapping = _new_id_mapping(args.seed_case_id_map)
        id_mapping["cases"] = {
            **seed_mapping["cases"],
            **id_mapping["cases"],
        }
        baseline_cases = _read_existing_cases(args.baseline_csv)
        existing = _read_existing_cases(existing_path)
        id_mapping["reserved_ids"] = sorted(
            set(id_mapping["reserved_ids"])
            | set(seed_mapping["reserved_ids"])
            | set(seed_mapping["cases"].values())
            | {row["Test Case ID"] for row in baseline_cases.values()}
            | {row["Test Case ID"] for row in existing.values()}
        )
        backend = BackendIndex(args.backend_root, args.openapi.resolve().parents[2])
        candidates, apis_with_cases, warnings = _generate_candidates(
            spec, inventory, api_id_mapping, backend
        )
        _assign_case_ids(candidates, id_mapping)

        generated_rows = [candidate.row for candidate in candidates]
        generated_ids = {row["Test Case ID"] for row in generated_rows}
        current_records: dict[str, dict[str, str]] = {}
        changed_count = 0
        unchanged_count = 0
        new_count = 0
        review_reasons_by_id: dict[str, list[str]] = {}
        case_evidence: dict[str, list[dict[str, str]]] = {}
        candidate_by_id = {candidate.row["Test Case ID"]: candidate for candidate in candidates}

        for case_id, generated in (
            (row["Test Case ID"], row) for row in generated_rows
        ):
            old = existing.get(case_id)
            merged, changed, approved = _merge_case(generated, old)
            current_records[case_id] = merged
            candidate = candidate_by_id[case_id]
            reasons = list(candidate.review_reasons)
            if old is None:
                new_count += 1
            elif changed:
                changed_count += 1
                if approved:
                    reasons.append(
                        "Đặc tả sinh khác case đã duyệt; giữ nguyên nội dung và Review Status, cần review thủ công."
                    )
                else:
                    reasons.append("Case khác dữ liệu sinh hiện tại; trường người dùng đã điền được giữ nguyên.")
            else:
                unchanged_count += 1
            if not merged.get("Requirement ID"):
                reasons.append("Requirement ID đang để trống.")
            if not merged.get("Expected HTTP Status"):
                reasons.append("Expected HTTP Status đang để trống.")
            if not merged.get("Expected Database Effect"):
                reasons.append("Expected Database Effect đang để trống.")
            if reasons:
                review_reasons_by_id[case_id] = list(dict.fromkeys(reasons))
            case_evidence[case_id] = [
                item.as_dict() for item in dict.fromkeys(candidate.evidence)
            ]

        disappeared_ids = set(existing) - generated_ids
        output_rows = list(current_records.values())
        for case_id in sorted(disappeared_ids):
            output_rows.append(existing[case_id])
            review_reasons_by_id[case_id] = [
                "Case cũ không còn được đề xuất từ OpenAPI/Inventory hiện tại; giữ nguyên để QA xem xét."
            ]
        output_rows.sort(key=lambda row: row["Test Case ID"])
        _validate_rows(output_rows)

        review_rows = [
            {**current_records.get(case_id, existing.get(case_id, {})), "Review Reason": "; ".join(reasons)}
            for case_id, reasons in sorted(review_reasons_by_id.items())
        ]
        type_counts = dict(Counter(row["Test Type"] for row in generated_rows))
        priority_counts = dict(Counter(row["Priority"] for row in generated_rows))
        api_case_counts = Counter(row["API ID"] for row in generated_rows)
        module_case_counts = Counter(row["Module"] or "Chưa phân loại" for row in generated_rows)
        proposal_missing_status_count = sum(
            not row["Expected HTTP Status"] for row in generated_rows
        )
        proposal_missing_db_effect_count = sum(
            not row["Expected Database Effect"] for row in generated_rows
        )
        missing_status_count = sum(
            not row["Expected HTTP Status"] for row in output_rows
        )
        missing_db_effect_count = sum(
            not row["Expected Database Effect"] for row in output_rows
        )
        inventory_api_counts = {
            row["API ID"]: api_case_counts.get(row["API ID"], 0)
            for row in inventory.values()
            if API_ID_PATTERN.fullmatch(row.get("API ID", ""))
        }
        seed_case_ids = set(seed_mapping["cases"].values()) | set(seed_mapping["reserved_ids"])
        reused_case_ids = [
            candidate.row["Test Case ID"]
            for candidate in candidates
            if id_mapping["cases"].get(
                f"{candidate.api_id}|{candidate.scenario_key}"
            )
            == seed_mapping["cases"].get(
                f"{candidate.api_id}|{candidate.scenario_key}"
            )
            and f"{candidate.api_id}|{candidate.scenario_key}" in seed_mapping["cases"]
        ]
        reused_case_id_set = set(reused_case_ids)
        review_reason_counts = Counter(
            reason
            for reasons in review_reasons_by_id.values()
            for reason in reasons
        )

        report = {
            "generated_date": date.today().isoformat(),
            "inputs": {
                "openapi": str(args.openapi),
                "api_inventory": str(args.inventory),
                "api_id_mapping": str(args.api_id_map),
                "backend_root": str(args.backend_root),
                "test_case_id_mapping": str(args.case_id_map),
                "baseline_csv": str(args.baseline_csv),
                "seed_case_id_mapping": str(args.seed_case_id_map),
                "inventory_header_missing": headerless_inventory,
            },
            "scope_note": (
                "Các số liệu là kịch bản được đề xuất từ phân tích tĩnh; không đại diện test execution "
                "hoặc mức độ bao phủ kiểm thử thực tế."
            ),
            "totals": {
                "apis_analyzed": sum(
                    1
                    for endpoint, path_item in spec["paths"].items()
                    if isinstance(path_item, Mapping)
                    for method in path_item
                    if str(method).upper() in METHODS
                ),
                "test_cases_proposed": len(generated_rows),
                "test_cases_in_output": len(output_rows),
                "test_cases_requiring_verification": len(review_reasons_by_id),
                "test_cases_missing_expected_http_status": missing_status_count,
                "test_cases_missing_expected_database_effect": missing_db_effect_count,
                "proposals_missing_expected_http_status": proposal_missing_status_count,
                "proposals_missing_expected_database_effect": proposal_missing_db_effect_count,
                "apis_without_test_cases": len(
                    {
                        operation_key(str(method).upper(), str(endpoint))
                        for endpoint, path_item in spec["paths"].items()
                        if isinstance(path_item, Mapping)
                        for method in path_item
                        if str(method).upper() in METHODS
                    }
                    - apis_with_cases
                ),
                "new": new_count,
                "changed": changed_count,
                "unchanged": unchanged_count,
                "retained_no_longer_proposed": len(disappeared_ids),
                "test_cases_by_type": type_counts,
                "test_cases_by_priority": priority_counts,
                "test_cases_by_api_id": dict(sorted(api_case_counts.items())),
                "test_cases_by_module": dict(sorted(module_case_counts.items())),
                "inventory_api_case_counts": dict(sorted(inventory_api_counts.items())),
                "test_case_ids_reused_from_baseline": len(reused_case_ids),
                "test_case_ids_new_in_v2": sum(
                    row["Test Case ID"] not in seed_case_ids for row in generated_rows
                ),
                "baseline_ids_not_reused": len(seed_case_ids - generated_ids),
                "review_reasons": dict(sorted(review_reason_counts.items())),
            },
            "backend_evidence_index": {
                "global_validation": [item.as_dict() for item in backend.validation_evidence],
                "jwt_guard": [item.as_dict() for item in backend.jwt_evidence],
                "admin_role_guard": [item.as_dict() for item in backend.admin_role_evidence],
                "dto_classes_indexed": len(backend.dto_classes),
                "controllers_indexed": len(backend.controllers),
            },
            "case_evidence": case_evidence,
            "warnings": warnings
            + (
                ["API Inventory header is missing; read-only positional parsing used with the known 15-column schema."]
                if headerless_inventory
                else []
            ),
        }

        print(f"APIs analyzed: {report['totals']['apis_analyzed']}")
        print(f"Test cases proposed: {len(generated_rows)}")
        print(f"Test cases by type: {json.dumps(type_counts, ensure_ascii=True)}")
        print(f"Test cases by priority: {json.dumps(priority_counts, ensure_ascii=True)}")
        print(f"Test cases requiring verification: {len(review_reasons_by_id)}")
        print(f"Missing Expected HTTP Status: {missing_status_count}")
        print(f"Missing Expected Database Effect: {missing_db_effect_count}")
        print(f"APIs without test cases: {report['totals']['apis_without_test_cases']}")
        print(
            f"New/changed/unchanged/retained: {new_count}/{changed_count}/"
            f"{unchanged_count}/{len(disappeared_ids)}"
        )
        if headerless_inventory:
            print("Warning: API Inventory has no header; interpreted in memory using its 15-column schema.")
        if warnings:
            print(f"Warnings: {len(warnings)} (see generation report)")
        if args.dry_run:
            print("Dry run: no files written.")
            return 0

        outputs = {
            args.output: _csv_bytes(output_rows, COLUMNS),
            args.case_id_map: _json_bytes(id_mapping),
            args.review_output: _csv_bytes(review_rows, REVIEW_COLUMNS),
            args.report_output: _json_bytes(report),
        }
        backups = _write_safely(outputs)
        print(f"Test cases written: {args.output}")
        print(f"Test case ID mapping written: {args.case_id_map}")
        print(f"Review list written: {args.review_output}")
        print(f"Generation report written: {args.report_output}")
        for backup in backups:
            print(f"Backup created: {backup}")
        return 0
    except (OSError, ValueError, csv.Error, TypeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
