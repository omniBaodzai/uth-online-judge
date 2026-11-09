import csv
import json
import tempfile
import unittest
from pathlib import Path

from testing.scripts.generate_api_inventory import (
    COLUMNS,
    _csv_bytes,
    _load_id_mapping,
    _read_existing_csv,
    _write_safely,
    authentication_required,
    extract_operations,
    generate_inventory,
    operation_key,
)


def operation(
    method: str = "get",
    *,
    tags: list[str] | None = None,
    operation_id: str = "getItem",
    security: object = None,
) -> dict:
    result = {
        "operationId": operation_id,
        "tags": tags or ["Items"],
        "summary": "Tóm tắt",
        "description": "Mô tả",
        "responses": {"200": {"description": "OK"}, "404": {"description": "Missing"}},
    }
    if security is not None:
        result["security"] = security
    return result


def spec_with(*operations: tuple[str, str, dict], **extra: object) -> dict:
    spec = {"openapi": "3.0.0", "info": {"version": "1"}, "paths": {}}
    spec.update(extra)
    for method, endpoint, data in operations:
        spec["paths"].setdefault(endpoint, {})[method] = data
    return spec


class InventoryTests(unittest.TestCase):
    def test_extracts_only_supported_operations(self) -> None:
        spec = spec_with(
            ("get", "/items", operation()),
            ("post", "/items", operation("post")),
            ("options", "/items", operation("options")),
        )
        self.assertEqual(
            [(method, path) for method, path, _ in extract_operations(spec)],
            [("GET", "/items"), ("POST", "/items")],
        )

    def test_operation_security_overrides_global_security(self) -> None:
        spec = {"security": [{"bearerAuth": []}]}
        self.assertEqual(authentication_required({}, spec), "Có")
        self.assertEqual(authentication_required({"security": []}, spec), "Không")
        self.assertEqual(authentication_required({"security": [{}]}, {}), "Không")
        self.assertEqual(authentication_required({"security": [{"key": []}]}, {}), "Có")
        self.assertEqual(authentication_required({}, {}), "")

    def test_fixed_ids_and_generated_ids_are_stable_across_order(self) -> None:
        register = operation("post", tags=["Authentication"], operation_id="register")
        login = operation("post", tags=["Authentication"], operation_id="login")
        health = operation(tags=["System"], operation_id="health")
        other = operation(tags=["Items"], operation_id="listItems")
        items = [("post", "/auth/register", register), ("post", "/auth/login", login),
                 ("get", "/", health), ("get", "/items", other)]
        mapping_a = {"operations": {}, "module_codes": {}}
        rows_a, ids_a, _, _ = generate_inventory(spec_with(*items), mapping_a, {})
        mapping_b = {"operations": {}, "module_codes": {}}
        rows_b, ids_b, _, _ = generate_inventory(spec_with(*reversed(items)), mapping_b, {})

        expected = {
            "POST /auth/register": "API-AUTH-001",
            "POST /auth/login": "API-AUTH-002",
            "GET /": "API-SYS-001",
        }
        for key, api_id in expected.items():
            self.assertEqual(ids_a[key], api_id)
        self.assertEqual(ids_a["GET /items"], ids_b["GET /items"])
        self.assertEqual({row["API ID"] for row in rows_a}, {row["API ID"] for row in rows_b})

    def test_existing_ids_and_user_edits_are_preserved(self) -> None:
        current_operation = operation()
        key = operation_key("GET", "/items")
        previous = {column: "" for column in COLUMNS}
        previous.update({
            "API ID": "API-ITEMS-042",
            "HTTP Method": "GET",
            "Endpoint": "/items",
            "Summary": "Đã được duyệt",
            "Test Coverage Status": "Đã bao phủ",
        })
        rows, ids, changed, _ = generate_inventory(
            spec_with(("get", "/items", current_operation)),
            {"operations": {}, "module_codes": {}},
            {key: previous},
        )
        self.assertEqual(ids[key], "API-ITEMS-042")
        self.assertEqual(rows[0]["Summary"], "Đã được duyệt")
        self.assertEqual(rows[0]["Test Coverage Status"], "Đã bao phủ")
        self.assertIn(key, changed)

    def test_disappeared_api_is_retained_and_reported(self) -> None:
        stale = {column: "" for column in COLUMNS}
        stale.update({"API ID": "API-OLD-001", "HTTP Method": "GET", "Endpoint": "/old"})
        rows, _, _, _ = generate_inventory(
            spec_with(("get", "/new", operation())),
            {"operations": {}, "module_codes": {}},
            {"GET /old": stale},
        )
        self.assertEqual({row["Endpoint"] for row in rows}, {"/new", "/old"})

    def test_missing_security_and_roles_are_marked_for_verification(self) -> None:
        rows, _, _, verification = generate_inventory(
            spec_with(("get", "/items", operation())),
            {"operations": {}, "module_codes": {}},
            {},
        )
        row = rows[0]
        self.assertEqual(row["Authentication Required"], "")
        self.assertEqual(row["Required Role"], "")
        self.assertIn("Authentication Required", verification["GET /items"])
        self.assertIn("Required Role", verification["GET /items"])
        self.assertEqual(row["Test Coverage Status"], "Chưa bao phủ")

    def test_request_content_type_success_status_and_swagger_reference(self) -> None:
        create = operation("post", tags=["Items"], operation_id="createItem")
        create["requestBody"] = {
            "content": {
                "application/json": {"schema": {}},
                "application/xml": {"schema": {}},
            }
        }
        create["responses"] = {
            "201": {"description": "Created"},
            "204": {"description": "Empty"},
            "400": {"description": "Invalid"},
            "default": {"description": "Other"},
        }
        rows, _, _, _ = generate_inventory(
            spec_with(("post", "/items", create)),
            {"operations": {}, "module_codes": {}},
            {},
        )
        self.assertEqual(
            rows[0]["Request Content Type"], "application/json; application/xml"
        )
        self.assertEqual(rows[0]["Expected Success Status"], "201, 204")
        self.assertEqual(
            rows[0]["Swagger Reference"],
            "http://localhost:3000/api#/Items/createItem",
        )

    def test_csv_has_utf8_bom_and_exact_column_order(self) -> None:
        data = _csv_bytes([{"Summary": "Kiểm tra"}], COLUMNS)
        self.assertTrue(data.startswith(b"\xef\xbb\xbf"))
        decoded = data.decode("utf-8-sig")
        self.assertEqual(next(csv.reader(decoded.splitlines())), COLUMNS)
        self.assertIn("Kiểm tra", decoded)

    def test_existing_csv_rejects_duplicate_operations(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "inventory.csv"
            path.write_text(
                "HTTP Method,Endpoint\nGET,/items\nGET,/items\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "duplicate API"):
                _read_existing_csv(path)

    def test_safe_write_creates_backup_before_replacing_existing_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.csv"
            path.write_bytes(b"old")
            backups = _write_safely({path: b"new"})
            self.assertEqual(path.read_bytes(), b"new")
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), b"old")

    def test_id_mapping_round_trips_as_json_compatible_data(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "mapping.json"
            mapping = {"operations": {"GET /": "API-SYS-001"}, "module_codes": {}}
            path.write_bytes((json.dumps(mapping) + "\n").encode("utf-8"))
            loaded = _load_id_mapping(path)
            self.assertEqual(loaded, mapping)


if __name__ == "__main__":
    unittest.main()
