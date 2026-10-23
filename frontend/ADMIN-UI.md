# Admin console

The Admin console is connected to the NestJS API and PostgreSQL. Admin login uses the existing authentication flow; protected Admin routes and API endpoints require an active account with the `ADMIN` role. The frontend role check improves navigation, but the backend guard is the authorization boundary.

## Routes

- `/admin/login` — sign in with an existing Admin account.
- `/admin` — dashboard counts and recently updated problems.
- `/admin/problems` — server-side search, filters, pagination, status changes, and draft deletion.
- `/admin/problems/new` — create a problem.
- `/admin/problems/:id/edit` — update problem details, custom tags, supported languages, and public examples.
- `/admin/problems/:id/test-cases` — manage public and hidden test cases. Hidden data is available only through Admin-protected endpoints.

Problem fields and test cases are persisted by the backend. Tags typed in the problem form are created as needed. Languages must already be enabled in the `programming_languages` table because each supported language must have a configured Judge0 language ID; the form only offers enabled languages. The inspected local database currently has no enabled language rows, so its language selector stays empty until an operator configures the catalog.

The Admin UI does not currently include editorial management.

## Backend and database setup

From the repository root in PowerShell, start the required Compose services:

```powershell
docker compose up -d postgres redis backend frontend
docker compose logs --tail 100 backend
```

Migration `backend/sql/migrations/003_admin_support.sql` provides user roles and problem-language links. The live database was inspected and already contains both. Migration `backend/sql/migrations/004_admin_problem_summary.sql` is a new, additive migration for the short description field. It has **not** been applied. Review its SQL and impact before applying it.

After approving and reviewing the new migration, apply it manually from the repository root:

```powershell
Get-Content .\backend\sql\migrations\004_admin_problem_summary.sql | docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

The migration adds only `problems.summary VARCHAR(200) NULL`. It preserves every existing column and row; existing problems receive `NULL` for the new field. Do not run it until its SQL has been reviewed and approved.

Promote a user to Admin only through an authorized operator procedure after verifying the account identity. For example, using a placeholder email in an approved SQL session:

```sql
UPDATE users
SET role = 'ADMIN', updated_at = CURRENT_TIMESTAMP
WHERE lower(email) = lower('<verified-admin-email>');
```

Do not expose an Admin registration route or promote accounts based on frontend input. JWT-authenticated requests load the account's current role and active state from PostgreSQL, so a role change takes effect on the next request.

## Sign in and verify

Create an Admin access token through the login page at `/admin/login`, then use the console to create a draft problem. The UI shows a success notice only after the API confirms the database write. To watch backend errors:

```powershell
docker compose logs --tail 100 -f backend
```

If the API reports a missing `summary` column, the new migration is still pending. If the database connection fails, verify the backend container uses `DB_HOST=postgres`, the PostgreSQL service is healthy, and the backend has the correct Compose environment. Do not set the Redis host to `localhost` inside a container; Redis settings are separate from the Admin API.

## Tests and checks

From the repository root:

```powershell
cd backend
npm test -- --run
npm run build
npm run lint
cd ..\frontend
npm run build
npm run lint
```

Backend unit tests mock database access and do not require a running PostgreSQL instance. They verify role authorization, current-role lookup, parameterized Admin queries, and preservation of test-case whitespace.
