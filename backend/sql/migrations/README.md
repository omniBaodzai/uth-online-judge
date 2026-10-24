# Database migrations

Apply numbered migrations in ascending order using the database's normal migration process.

- `010_unified_test_case_management.sql` adds optimistic revisions for admin test-case collections and normalizes every test case to one point.
- `011_cumulative_test_case_progress.sql` adds idempotent, content-versioned records for accepted test cases. Historical submissions and their stored scores are not rewritten.

The backend must be deployed with the corresponding application code after these migrations are applied. Cumulative progress counts only accepted results from completely finalized submissions and only when the test case remains active with matching input and expected-output content.
