import csv
import json
import tempfile
import unittest
from pathlib import Path

from testing.scripts.generate_api_inventory import COLUMNS as API_INVENTORY_COLUMNS
from testing.scripts.generate_test_cases import (
    AUTOMATION_STATUSES,
    COLUMNS,
    PRIORITIES,
    REVIEW_STATUSES,
    TEST_TYPES,
    BackendIndex,
    Candidate,
    _assign_case_ids,
    _csv_bytes,
    _declared_error_status,
    _merge_case,
    _read_inventory,
    _validate_rows,
    _write_safely,
    _generate_candidates,
)


def candidate(api_id: str = "API-AUTH-001", scenario_key: str = "success") -> Candidate:
    row = {column: "" for column in COLUMNS}
    row.update(
        {
            "Test Case ID": "",
            "API ID": api_id,
            "Test Type": "Kiểm thử tích cực",
            "Priority": "Cao",
            "Automation Status": "Đã lên kế hoạch",
            "Review Status": "Bản nháp",
        }
    )
    return Candidate(api_id, scenario_key, "TC-AUTH-LOGIN", row, [], [])


class TestCaseGeneratorTests(unittest.TestCase):
    def test_exactly_22_columns_in_required_order(self) -> None:
        self.assertEqual(
            COLUMNS,
            [
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
            ],
        )

    def test_csv_has_utf8_bom_and_preserves_multiline_cells(self) -> None:
        row = {column: "" for column in COLUMNS}
        row["Test Steps"] = "Bước 1\nBước 2"
        row["Test Type"] = "Kiểm thử tích cực"
        data = _csv_bytes([row], COLUMNS)
        self.assertTrue(data.startswith(b"\xef\xbb\xbf"))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.csv"
            path.write_bytes(data)
            with path.open(encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                self.assertEqual(reader.fieldnames, COLUMNS)
                self.assertEqual(next(reader)["Test Steps"], "Bước 1\nBước 2")

    def test_case_ids_are_unique_and_scenario_keys_are_unique_per_api(self) -> None:
        items = [candidate(scenario_key="success"), candidate(scenario_key="missing-token")]
        mapping = {"version": 1, "cases": {}, "reserved_ids": []}
        _assign_case_ids(items, mapping)
        self.assertEqual(len({item.row["Test Case ID"] for item in items}), 2)
        with self.assertRaisesRegex(ValueError, "Duplicate scenario key"):
            _assign_case_ids(
                [candidate(), candidate()],
                {"version": 1, "cases": {}, "reserved_ids": []},
            )

    def test_case_id_mapping_is_stable_across_candidate_order(self) -> None:
        first = [candidate(scenario_key="success"), candidate(scenario_key="missing-token")]
        second = [candidate(scenario_key="missing-token"), candidate(scenario_key="success")]
        mapping_a = {"version": 1, "cases": {}, "reserved_ids": []}
        mapping_b = {"version": 1, "cases": {}, "reserved_ids": []}
        _assign_case_ids(first, mapping_a)
        _assign_case_ids(second, mapping_b)
        self.assertEqual(
            {item.scenario_key: item.row["Test Case ID"] for item in first},
            {item.scenario_key: item.row["Test Case ID"] for item in second},
        )

    def test_case_id_mapping_does_not_reuse_retired_sequence(self) -> None:
        item = candidate(scenario_key="new-case")
        mapping = {
            "version": 1,
            "cases": {},
            "reserved_ids": ["TC-AUTH-LOGIN-001"],
        }
        _assign_case_ids([item], mapping)
        self.assertEqual(item.row["Test Case ID"], "TC-AUTH-LOGIN-002")

    def test_only_declared_http_error_statuses_are_used(self) -> None:
        operation = {"responses": {"200": {}, "401": {}, "400": {}}}
        self.assertEqual(_declared_error_status(operation, ("401",)), "401")
        self.assertEqual(_declared_error_status({"responses": {"200": {}}}, ("401",)), "")

    def test_approved_case_is_never_overwritten(self) -> None:
        generated = {column: "" for column in COLUMNS}
        generated.update(
            {
                "Test Case ID": "TC-AUTH-LOGIN-001",
                "API ID": "API-AUTH-001",
                "Test Scenario": "New generated scenario",
                "Review Status": "Bản nháp",
            }
        )
        approved = dict(generated)
        approved.update(
            {
                "Test Scenario": "Approved wording",
                "Review Status": "Đã duyệt",
                "Notes": "Approved note",
            }
        )
        merged, changed, is_approved = _merge_case(generated, approved)
        self.assertTrue(changed)
        self.assertTrue(is_approved)
        self.assertEqual(merged, approved)
        self.assertEqual(merged["Review Status"], "Đã duyệt")

    def test_inventory_without_header_is_read_positionally(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "inventory.csv"
            row = ["API-SYS-001", "System", "GET", "/"] + [""] * (len(API_INVENTORY_COLUMNS) - 4)
            with path.open("w", encoding="utf-8-sig", newline="") as stream:
                csv.writer(stream).writerow(row)
            records, headerless = _read_inventory(path)
        self.assertTrue(headerless)
        self.assertEqual(records["GET /"]["API ID"], "API-SYS-001")

    def test_no_case_is_generated_without_a_valid_api_id(self) -> None:
        spec = {
            "openapi": "3.0.0",
            "paths": {"/health": {"get": {"operationId": "HealthController_get", "responses": {"200": {}}}}},
        }
        with tempfile.TemporaryDirectory() as directory:
            backend = BackendIndex(Path(directory), Path(directory))
            candidates, _, warnings = _generate_candidates(
                spec,
                {"GET /health": {"API ID": "not-an-api-id", "Module": "System"}},
                {"operations": {}},
                backend,
            )
        self.assertEqual(candidates, [])
        self.assertTrue(any("no valid API ID" in warning for warning in warnings))

    def test_array_boundaries_ignore_string_length_validators(self) -> None:
        spec = {
            "openapi": "3.0.0",
            "paths": {
                "/items": {
                    "post": {
                        "operationId": "ItemsController_create",
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/CreateItemDto"}
                                }
                            },
                        },
                        "responses": {"201": {"description": "Created"}},
                    }
                }
            },
            "components": {
                "schemas": {
                    "CreateItemDto": {
                        "type": "object",
                        "required": ["tags"],
                        "properties": {
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "maxItems": 2,
                            }
                        },
                    }
                }
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            backend_root = root / "backend"
            dto_dir = backend_root / "src" / "items" / "dto"
            dto_dir.mkdir(parents=True)
            (dto_dir / "create-item.dto.ts").write_text(
                "export class CreateItemDto {\n"
                "  @MaxLength(100)\n"
                "  tags: string[];\n"
                "}\n",
                encoding="utf-8",
            )
            backend = BackendIndex(backend_root, root)
            candidates, _, _ = _generate_candidates(
                spec,
                {"POST /items": {"API ID": "API-ITEM-001", "Module": "Items"}},
                {"operations": {"POST /items": "API-ITEM-001"}},
                backend,
            )

        boundaries = [
            item
            for item in candidates
            if item.api_id == "API-ITEM-001"
            and item.scenario_key == "boundary-tags-max"
        ]
        self.assertEqual(len(boundaries), 1)
        self.assertIn("maxItems=2", boundaries[0].row["Test Scenario"])
        invalid_boundaries = [
            item
            for item in candidates
            if item.api_id == "API-ITEM-001"
            and item.scenario_key == "boundary-invalid-tags-max"
        ]
        self.assertEqual(len(invalid_boundaries), 1)
        self.assertIn("maxItems=2", invalid_boundaries[0].row["Test Scenario"])

    def test_controller_index_finds_multiple_controllers_in_one_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            controller_file = root / "src" / "community" / "news.controller.ts"
            controller_file.parent.mkdir(parents=True)
            controller_file.write_text(
                "\n".join(
                    [
                        "export class NewsController {",
                        "  list() {}",
                        "}",
                        "@UseGuards(JwtAuthGuard, AdminRoleGuard)",
                        "export class AdminNewsController {",
                        "  remove() {}",
                        "}",
                    ]
                ),
                encoding="utf-8",
            )
            backend = BackendIndex(root, root)
            route = backend.route("AdminNewsController_remove")
        self.assertIsNotNone(route)
        assert route is not None
        self.assertIn("AdminRoleGuard", route.guards)

    def test_missing_auth_status_is_left_blank_when_not_declared(self) -> None:
        spec = {
            "openapi": "3.0.0",
            "security": [{"bearer": []}],
            "paths": {"/private": {"get": {"operationId": "PrivateController_get", "responses": {"200": {}}}}},
        }
        with tempfile.TemporaryDirectory() as directory:
            backend = BackendIndex(Path(directory), Path(directory))
            candidates, _, _ = _generate_candidates(
                spec,
                {"GET /private": {"API ID": "API-TEST-001", "Module": "Private"}},
                {"operations": {}},
                backend,
            )
        auth_case = next(item for item in candidates if item.scenario_key == "auth-missing-token")
        self.assertEqual(auth_case.row["Expected HTTP Status"], "")

    def test_manual_auth_steps_use_postman_bearer_token_syntax(self) -> None:
        spec = {
            "openapi": "3.0.0",
            "security": [{"bearerAuth": []}],
            "components": {
                "securitySchemes": {
                    "bearerAuth": {"type": "http", "scheme": "bearer"}
                }
            },
            "paths": {
                "/private": {
                    "get": {
                        "operationId": "PrivateController_get",
                        "responses": {"200": {"description": "OK"}},
                    }
                }
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            backend = BackendIndex(Path(directory), Path(directory))
            candidates, _, _ = _generate_candidates(
                spec,
                {"GET /private": {"API ID": "API-TEST-001", "Module": "Private"}},
                {"operations": {"GET /private": "API-TEST-001"}},
                backend,
            )
        success = next(item for item in candidates if item.scenario_key == "success")
        auth_scheme = "".join(chr(value) for value in (66, 101, 97, 114, 101, 114))
        self.assertIn("nhập " + auth_scheme, success.row["Test Steps"])
        self.assertIn("{{AUTH_VALID_ACCESS_TOKEN}}", success.row["Test Steps"])
        self.assertNotIn("*" * 6, success.row["Test Steps"])

    def test_dry_run_does_not_write_any_output(self) -> None:
        from contextlib import redirect_stdout
        from io import StringIO

        from testing.scripts.generate_test_cases import main

        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            root = Path(directory)
            testing_root = root / "testing"
            openapi_dir = testing_root / "openapi"
            output_dir = testing_root / "output"
            openapi_dir.mkdir(parents=True)
            output_dir.mkdir(parents=True)
            openapi = openapi_dir / "openapi.json"
            inventory = output_dir / "inventory.csv"
            api_map = output_dir / "api_ids.json"
            backend = root / "backend"
            backend.mkdir()
            openapi.write_text(
                json.dumps(
                    {
                        "openapi": "3.0.0",
                        "paths": {"/health": {"get": {"operationId": "HealthController_get", "responses": {"200": {"description": "OK"}}}}},
                    }
                ),
                encoding="utf-8",
            )
            api_row = ["API-SYS-001", "System", "GET", "/", "Health"] + [""] * (
                len(API_INVENTORY_COLUMNS) - 5
            )
            with inventory.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.writer(stream)
                writer.writerow(API_INVENTORY_COLUMNS)
                writer.writerow(api_row)
            api_map.write_text(
                json.dumps({"operations": {"GET /health": "API-SYS-001"}}),
                encoding="utf-8",
            )
            outputs = [
                output_dir / "test_cases.csv",
                output_dir / "case_ids.json",
                output_dir / "review.csv",
                output_dir / "report.json",
            ]
            args = [
                "--openapi", str(openapi),
                "--inventory", str(inventory),
                "--api-id-map", str(api_map),
                "--backend-root", str(backend),
                "--output", str(outputs[0]),
                "--case-id-map", str(outputs[1]),
                "--review-output", str(outputs[2]),
                "--report-output", str(outputs[3]),
                "--dry-run",
            ]
            with redirect_stdout(StringIO()):
                self.assertEqual(main(args), 0)
            self.assertTrue(all(not path.exists() for path in outputs))

    def test_outputs_cannot_escape_testing_directory(self) -> None:
        from contextlib import redirect_stderr
        from io import StringIO

        from testing.scripts.generate_test_cases import main

        with tempfile.TemporaryDirectory() as directory:
            outside_output = Path(directory) / "outside.csv"
            with redirect_stderr(StringIO()):
                result = main(["--output", str(outside_output), "--dry-run"])
        self.assertEqual(result, 1)
        self.assertFalse(outside_output.exists())

    def test_safe_write_creates_backup(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.csv"
            path.write_bytes(b"old")
            backups = _write_safely({path: b"new"})
            self.assertEqual(path.read_bytes(), b"new")
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), b"old")

    def test_allowed_enumerations_are_enforced(self) -> None:
        row = {column: "" for column in COLUMNS}
        row.update(
            {
                "Test Case ID": "TC-AUTH-LOGIN-001",
                "API ID": "API-AUTH-001",
                "Test Type": "Kiểm thử tích cực",
                "Priority": "Cao",
                "Automation Status": "Đã lên kế hoạch",
                "Review Status": "Bản nháp",
            }
        )
        _validate_rows([row])
        self.assertEqual(len(TEST_TYPES), 10)
        self.assertEqual(len(PRIORITIES), 4)
        self.assertEqual(len(AUTOMATION_STATUSES), 3)
        self.assertEqual(len(REVIEW_STATUSES), 3)
        row["Priority"] = "P0"
        with self.assertRaisesRegex(ValueError, "Invalid Priority"):
            _validate_rows([row])


if __name__ == "__main__":
    unittest.main()
