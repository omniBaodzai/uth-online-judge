#!/usr/bin/env python3
"""Generate a reviewable CSV inventory from an OpenAPI 3 specification."""

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
import unicodedata
from collections.abc import Mapping, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote


COLUMNS = [
    "API ID",
    "Module",
    "HTTP Method",
    "Endpoint",
    "Summary",
    "Description",
    "Authentication Required",
    "Required Role",
    "Request Content Type",
    "Expected Success Status",
    "API Version",
    "Swagger Reference",
    "Implementation Status :",
    "Test Coverage Status",
    "Notes",
]
REVIEW_COLUMNS = [*COLUMNS, "Review Reason"]
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
SWAGGER_BASE_URL = "http://localhost:3000/api"
FIXED_IDS = {
    "GET /": "API-SYS-001",
    "POST /auth/register": "API-AUTH-001",
    "POST /auth/login": "API-AUTH-002",
}
FIXED_MODULE_CODES = {"System": "SYS", "Authentication": "AUTH"}
ID_PATTERN = re.compile(r"^API-[A-Z0-9-]+-(\d+)$")
SUCCESS_STATUS_PATTERN = re.compile(r"^2\d\d$")
TRACKED_FIELDS = [
    "API ID",
    "Module",
    "HTTP Method",
    "Endpoint",
    "Summary",
    "Description",
    "Authentication Required",
    "Required Role",
    "Request Content Type",
    "Expected Success Status",
    "API Version",
    "Swagger Reference",
]
OPERATION_IDENTITY_FIELDS = ("HTTP Method", "Endpoint")


def operation_key(method: str, endpoint: str) -> str:
    """Return a stable identity for one method/path pair."""
    return f"{method.upper()} {endpoint}"


def extract_operations(spec: Mapping[str, Any]) -> list[tuple[str, str, Mapping[str, Any]]]:
    """Extract supported operations and reject malformed or duplicate entries."""
    paths = spec.get("paths")
    if not isinstance(paths, Mapping):
        raise ValueError("OpenAPI document must contain a paths object.")

    operations: list[tuple[str, str, Mapping[str, Any]]] = []
    seen: set[str] = set()
    for endpoint, path_item in paths.items():
        if not isinstance(endpoint, str) or not isinstance(path_item, Mapping):
            continue
        for raw_method, operation in path_item.items():
            method = str(raw_method).upper()
            if method not in METHODS:
                continue
            if not isinstance(operation, Mapping):
                raise ValueError(f"Operation {method} {endpoint} must be an object.")
            key = operation_key(method, endpoint)
            if key in seen:
                raise ValueError(f"Duplicate OpenAPI operation: {key}")
            seen.add(key)
            operations.append((method, endpoint, operation))
    return operations


def authentication_required(
    operation: Mapping[str, Any], spec: Mapping[str, Any]
) -> str:
    """Resolve operation-level security before global security."""
    if "security" in operation:
        security = operation["security"]
    elif "security" in spec:
        security = spec["security"]
    else:
        return ""
    if not isinstance(security, list):
        return ""
    if any(isinstance(requirement, Mapping) and not requirement for requirement in security):
        return "Không"
    return "Có" if security else "Không"


def _ascii_words(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.findall(r"[A-Za-z0-9]+", ascii_value)


def _suggest_module_code(tag: str) -> str:
    if tag in FIXED_MODULE_CODES:
        return FIXED_MODULE_CODES[tag]
    words = _ascii_words(tag)
    if not words:
        return "GEN"
    if len(words) > 1:
        return "".join(word[0] for word in words).upper()
    return words[0][:4].upper()


def _module_codes(
    tags: set[str], stored_codes: Mapping[str, str]
) -> dict[str, str]:
    codes = dict(stored_codes)
    used = {code: tag for tag, code in codes.items()}
    for tag in sorted(tags):
        if tag in codes:
            continue
        code = _suggest_module_code(tag)
        if code in used and used[code] != tag:
            digest = hashlib.sha1(tag.encode("utf-8")).hexdigest().upper()
            length = 4
            while f"{code}-{digest[:length]}" in used:
                length += 2
            code = f"{code}-{digest[:length]}"
        codes[tag] = code
        used[code] = tag
    return codes


def _load_id_mapping(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"operations": {}, "module_codes": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid ID mapping JSON at {path}: {error}") from error
    if not isinstance(data, dict):
        raise ValueError(f"ID mapping at {path} must be a JSON object.")
    operations = data.get("operations", {})
    module_codes = data.get("module_codes", {})
    if not isinstance(operations, dict) or not isinstance(module_codes, dict):
        raise ValueError(f"ID mapping at {path} has invalid operations/module_codes.")
    if not all(isinstance(key, str) and isinstance(value, str) for key, value in operations.items()):
        raise ValueError(f"ID mapping at {path} contains a non-string operation ID.")
    if not all(isinstance(key, str) and isinstance(value, str) for key, value in module_codes.items()):
        raise ValueError(f"ID mapping at {path} contains an invalid module code.")
    return {"operations": operations, "module_codes": module_codes}


def _read_existing_csv(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists() or path.stat().st_size == 0:
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not set(OPERATION_IDENTITY_FIELDS).issubset(reader.fieldnames):
            raise ValueError(
                f"Existing CSV {path} must include HTTP Method and Endpoint columns."
            )
        records: dict[str, dict[str, str]] = {}
        for row in reader:
            method = (row.get("HTTP Method") or "").strip().upper()
            endpoint = (row.get("Endpoint") or "").strip()
            if not method or not endpoint:
                raise ValueError(f"Existing CSV {path} contains a row without method/endpoint.")
            key = operation_key(method, endpoint)
            if key in records:
                raise ValueError(f"Existing CSV {path} contains duplicate API: {key}")
            records[key] = {column: row.get(column, "") or "" for column in COLUMNS}
        return records


def _seed_ids_from_csv(
    mapping: dict[str, Any], existing: Mapping[str, Mapping[str, str]]
) -> None:
    for key, row in existing.items():
        existing_id = row.get("API ID", "").strip()
        if not existing_id or key in FIXED_IDS:
            continue
        mapping["operations"][key] = existing_id


def _allocate_ids(
    operations: Sequence[tuple[str, str, Mapping[str, Any]]],
    mapping: dict[str, Any],
) -> dict[str, str]:
    tags = {
        str(tag)
        for _, _, operation in operations
        for tag in (operation.get("tags") or [])
        if isinstance(tag, str) and tag
    }
    codes = _module_codes(tags, mapping["module_codes"])
    mapping["module_codes"] = codes
    assigned = mapping["operations"]

    for key, api_id in FIXED_IDS.items():
        assigned[key] = api_id

    reserved: dict[str, str] = {}
    for key, api_id in assigned.items():
        if api_id in reserved and reserved[api_id] != key:
            raise ValueError(f"API ID {api_id} is assigned to multiple operations.")
        reserved[api_id] = key

    missing: list[tuple[str, str, str]] = []
    for method, endpoint, operation in operations:
        key = operation_key(method, endpoint)
        if key in assigned:
            continue
        tags_for_operation = operation.get("tags")
        tag = tags_for_operation[0] if isinstance(tags_for_operation, list) and tags_for_operation else ""
        if not isinstance(tag, str) or not tag:
            tag = "Uncategorized"
            codes = _module_codes({tag}, mapping["module_codes"])
            mapping["module_codes"] = codes
        missing.append((key, tag, codes[tag]))

    counters: dict[str, int] = {}
    for api_id in assigned.values():
        match = ID_PATTERN.fullmatch(api_id)
        if match:
            # IDs are allocated by the module code immediately before the sequence.
            prefix = api_id.rsplit("-", 1)[0]
            sequence = int(match.group(1))
            counters[prefix] = max(counters.get(prefix, 0), sequence)

    for key, _, code in sorted(missing):
        prefix = f"API-{code}"
        sequence = counters.get(prefix, 0) + 1
        api_id = f"{prefix}-{sequence:03d}"
        while api_id in reserved:
            sequence += 1
            api_id = f"{prefix}-{sequence:03d}"
        assigned[key] = api_id
        reserved[api_id] = key
        counters[prefix] = sequence

    return assigned


def _content_types(operation: Mapping[str, Any]) -> str:
    request_body = operation.get("requestBody")
    if not isinstance(request_body, Mapping):
        return "Không có request body"
    content = request_body.get("content")
    if not isinstance(content, Mapping) or not content:
        return ""
    return "; ".join(str(content_type) for content_type in content)


def _success_statuses(operation: Mapping[str, Any]) -> str:
    responses = operation.get("responses")
    if not isinstance(responses, Mapping):
        return ""
    statuses = [
        str(status)
        for status in responses
        if SUCCESS_STATUS_PATTERN.fullmatch(str(status))
    ]
    return ", ".join(sorted(statuses, key=int))


def _swagger_reference(tag: str, operation_id: str) -> str:
    if not tag or not operation_id:
        return SWAGGER_BASE_URL
    return f"{SWAGGER_BASE_URL}#/{quote(tag, safe='')}/{quote(operation_id, safe='')}"


def _verification_notes(
    operation: Mapping[str, Any], spec: Mapping[str, Any], tag: str
) -> str:
    verification: list[str] = []
    if not tag:
        verification.append("Module (OpenAPI không khai báo tag)")
    if not operation.get("operationId") or not tag:
        verification.append("Swagger Reference (thiếu tag hoặc operationId)")
    if not authentication_required(operation, spec):
        verification.append("Authentication Required (security chưa được khai báo)")
    verification.append("Required Role (không có metadata vai trò đáng tin cậy)")
    if isinstance(operation.get("requestBody"), Mapping) and not _content_types(operation):
        verification.append("Request Content Type (requestBody không khai báo content)")
    if not _success_statuses(operation):
        verification.append("Expected Success Status (không khai báo status 2xx)")
    if not spec.get("info", {}).get("version"):
        verification.append("API Version (thiếu info.version)")
    verification.append("Implementation Status (không có bằng chứng triển khai)")
    if not operation.get("summary"):
        verification.append("Summary (OpenAPI không khai báo)")
    if not operation.get("description"):
        verification.append("Description (OpenAPI không khai báo)")
    return "Cần xác minh: " + "; ".join(verification)


def _build_row(
    method: str,
    endpoint: str,
    operation: Mapping[str, Any],
    spec: Mapping[str, Any],
    api_id: str,
) -> tuple[dict[str, str], str]:
    tags = operation.get("tags")
    tag = tags[0] if isinstance(tags, list) and tags and isinstance(tags[0], str) else ""
    info = spec.get("info")
    version = info.get("version", "") if isinstance(info, Mapping) else ""
    row = {
        "API ID": api_id,
        "Module": tag or "Chưa phân loại",
        "HTTP Method": method,
        "Endpoint": endpoint,
        "Summary": str(operation.get("summary") or ""),
        "Description": str(operation.get("description") or ""),
        "Authentication Required": authentication_required(operation, spec),
        "Required Role": "",
        "Request Content Type": _content_types(operation),
        "Expected Success Status": _success_statuses(operation),
        "API Version": str(version or ""),
        "Swagger Reference": _swagger_reference(tag, str(operation.get("operationId") or "")),
        "Implementation Status :": "",
        "Test Coverage Status": "Chưa bao phủ",
        "Notes": _verification_notes(operation, spec, tag),
    }
    return row, row["Notes"]


def _merge_existing(
    generated: Mapping[str, str], existing: Mapping[str, str] | None
) -> dict[str, str]:
    if existing is None:
        return dict(generated)
    merged = dict(generated)
    for column in COLUMNS:
        if existing.get(column, ""):
            merged[column] = existing[column]
    return merged


def generate_inventory(
    spec: Mapping[str, Any],
    id_mapping: dict[str, Any],
    existing: Mapping[str, Mapping[str, str]],
) -> tuple[list[dict[str, str]], dict[str, str], set[str], dict[str, str]]:
    """Build merged rows, updated IDs, changed operation keys, and verification notes."""
    operations = extract_operations(spec)
    if not operations:
        raise ValueError("No GET/POST/PUT/PATCH/DELETE operations found in OpenAPI.")
    _seed_ids_from_csv(id_mapping, existing)
    ids = _allocate_ids(operations, id_mapping)

    rows: list[dict[str, str]] = []
    changed: set[str] = set()
    verification: dict[str, str] = {}
    current_keys: set[str] = set()
    for method, endpoint, operation in operations:
        key = operation_key(method, endpoint)
        current_keys.add(key)
        generated, review_reason = _build_row(method, endpoint, operation, spec, ids[key])
        previous = existing.get(key)
        if previous is not None and any(
            previous.get(column, "") != generated[column] for column in TRACKED_FIELDS
        ):
            changed.add(key)
        rows.append(_merge_existing(generated, previous))
        if review_reason:
            verification[key] = review_reason

    disappeared = set(existing) - current_keys
    for key in sorted(disappeared):
        rows.append(dict(existing[key]))
    rows.sort(key=lambda row: (row["HTTP Method"], row["Endpoint"]))
    return rows, ids, changed, verification


def _csv_bytes(rows: Sequence[Mapping[str, str]], columns: Sequence[str]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8-sig")


def _json_bytes(data: Mapping[str, Any]) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _write_safely(outputs: Mapping[Path, bytes]) -> list[Path]:
    """Write all outputs via same-directory temporary files and back up prior files."""
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


def _review_rows(
    rows: Sequence[Mapping[str, str]],
    verification: Mapping[str, str],
    disappeared: set[str],
) -> list[dict[str, str]]:
    review: list[dict[str, str]] = []
    for row in rows:
        key = operation_key(row["HTTP Method"], row["Endpoint"])
        if key in disappeared:
            reason = "Endpoint không còn trong OpenAPI; giữ lại Inventory để người dùng xem xét."
        else:
            reason = verification.get(key, "")
        if reason:
            review.append({**row, "Review Reason": reason})
    return review


def _default_paths() -> tuple[Path, Path, Path, Path]:
    root = Path(__file__).resolve().parents[2]
    testing = root / "testing"
    output = testing / "output" / "api_inventory.csv"
    return (
        testing / "openapi" / "openapi.json",
        output,
        testing / "output" / "api_inventory_ids.json",
        testing / "output" / "api_inventory_review.csv",
    )


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    default_input, default_output, default_mapping, default_review = _default_paths()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=default_input, help="OpenAPI JSON file.")
    parser.add_argument("--output", type=Path, default=default_output, help="Inventory CSV output.")
    parser.add_argument(
        "--existing-csv",
        type=Path,
        help="Prior inventory CSV to merge; defaults to --output.",
    )
    parser.add_argument(
        "--id-map", type=Path, default=default_mapping, help="Persistent API ID mapping JSON."
    )
    parser.add_argument(
        "--review-output", type=Path, default=default_review, help="CSV of APIs requiring review."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Report changes without writing any files."
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    existing_path = args.existing_csv or args.output
    try:
        spec = json.loads(args.input.read_text(encoding="utf-8"))
        if not isinstance(spec, dict):
            raise ValueError("OpenAPI JSON root must be an object.")
        if not isinstance(spec.get("openapi"), str) or not spec["openapi"].startswith("3."):
            raise ValueError("Input must be an OpenAPI 3.x document.")
        info = spec.get("info")
        if not isinstance(info, Mapping):
            raise ValueError("OpenAPI document must contain an info object.")
        id_mapping = _load_id_mapping(args.id_map)
        existing = _read_existing_csv(existing_path)
        rows, ids, changed, verification = generate_inventory(spec, id_mapping, existing)
        operations = extract_operations(spec)
        current_keys = {operation_key(method, endpoint) for method, endpoint, _ in operations}
        disappeared = set(existing) - current_keys
        new_count = len(current_keys - set(existing))
        unchanged_count = len(current_keys & set(existing)) - len(changed)
        if len(operations) != len(current_keys):
            raise ValueError("Output validation failed: operation count does not match unique operations.")
        if len(rows) != len(current_keys) + len(disappeared):
            raise ValueError("Output validation failed: merged row count is inconsistent.")

        review_rows = _review_rows(rows, verification, disappeared)
        print(f"OpenAPI operations processed: {len(operations)}/{len(operations)}")
        print(f"New APIs: {new_count}")
        print(f"Changed APIs: {len(changed)}")
        print(f"Unchanged APIs: {unchanged_count}")
        print(f"APIs requiring verification: {len(verification)}")
        print(f"APIs missing from OpenAPI (retained for review): {len(disappeared)}")
        print(f"Inventory rows: {len(rows)}")
        if args.dry_run:
            print("Dry run: no files written.")
            return 0

        destinations = [args.output, args.id_map, args.review_output]
        resolved_destinations = [path.resolve() for path in destinations]
        if len(set(resolved_destinations)) != len(resolved_destinations):
            raise ValueError("Output, ID mapping, and review files must use different paths.")
        if args.input.resolve() in resolved_destinations:
            raise ValueError("An output path cannot overwrite the OpenAPI input file.")

        output_data = {
            args.output: _csv_bytes(rows, COLUMNS),
            args.id_map: _json_bytes(id_mapping),
            args.review_output: _csv_bytes(review_rows, REVIEW_COLUMNS),
        }
        backups = _write_safely(output_data)
        print(f"Inventory written: {args.output}")
        print(f"ID mapping written: {args.id_map}")
        print(f"Review list written: {args.review_output}")
        if backups:
            print("Backups created:")
            for backup in backups:
                print(f"  {backup}")
        return 0
    except (OSError, ValueError, csv.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
