# Database migrations

Apply numbered migrations in ascending order using the database's normal migration process.

- `010_unified_test_case_management.sql` adds optimistic revisions for admin test-case collections and normalizes every test case to one point.
- `011_cumulative_test_case_progress.sql` adds idempotent, content-versioned records for accepted test cases. Historical submissions and their stored scores are not rewritten.
- `012_nested_discussion_replies.sql` allows replies at any comment depth while preventing parent cycles.
- `013_profile_showcase.sql` adds optional cover-image URL and biography fields to user profiles without rewriting existing account data.
- `014_profile_cover_crop.sql` adds nullable crop metadata for uploaded profile cover images; existing profile images remain unchanged.
- `015_profile_organization.sql` adds an optional school or organization name to user profiles.

The backend must be deployed with the corresponding application code after these migrations are applied. Cumulative progress counts only accepted results from completely finalized submissions and only when the test case remains active with matching input and expected-output content.
