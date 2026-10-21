# Authentication setup and verification

## Configuration

Set `JWT_ACCESS_SECRET` in the local `.env` file to a randomly generated value of at least 32 characters. Do not commit that value. Set `FRONTEND_ORIGINS` to the exact browser origins allowed to call the API, and set the frontend build-time `VITE_API_BASE_URL` to the backend URL.

The refresh cookie is HttpOnly, scoped to `/auth`, uses `SameSite=Lax`, and is marked `Secure` in production. The browser must use credentials for API requests. The current cookie policy assumes the frontend and API are deployed on the same site; cross-site deployments require a deliberate cookie and CSRF review.

## Database migration

Back up the database and inspect existing data before applying `sql/migrations/001_authentication.sql`. The migration has not been run by the application setup. It adds case-insensitive unique indexes for username and email, validates that each user has an authentication method, and converts legacy refresh-token values to SHA-256 hashes while revoking those sessions. Duplicate case-insensitive usernames/emails, users with no password or OAuth identity, or refresh rows with neither a token nor a token hash can prevent the migration from completing. Missing user timestamps are backfilled by the migration. It uses PostgreSQL's built-in `sha256(bytea)` function and does not require installing an extension.

Before migrating, check the blockers without exposing account values:

```sql
SELECT COUNT(*) AS duplicate_email_groups
FROM (
  SELECT lower(email) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1
) duplicates;

SELECT COUNT(*) AS duplicate_username_groups
FROM (
  SELECT lower(username) FROM users
  WHERE username IS NOT NULL
  GROUP BY lower(username) HAVING COUNT(*) > 1
) duplicates;

SELECT COUNT(*) AS users_without_auth_method
FROM users
WHERE password_hash IS NULL AND google_id IS NULL AND github_id IS NULL;
```

Run the migration once using the project's PostgreSQL operator/tooling after reviewing those preconditions. All existing refresh sessions are invalidated so users must sign in again. Do not run the migration automatically at application startup.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account and sign in; returns user and access token, sets refresh cookie |
| `POST` | `/auth/login` | Sign in with username or email and password |
| `POST` | `/auth/refresh` | Rotate the HttpOnly refresh cookie and issue a new access token |
| `POST` | `/auth/logout` | Revoke the current refresh session and clear its cookie |
| `GET` | `/auth/me` | Return the current user; requires a bearer access token |

Swagger UI is available at `/api`. Use the `Authorize` control to set a bearer access token for `/auth/me`. To verify refresh/logout manually, use the browser-based frontend flow so the HttpOnly cookie is sent automatically.

## Local verification

From the repository root, keep the existing `.env` file (do not overwrite existing database credentials). Confirm it has a non-empty `JWT_ACCESS_SECRET` of at least 32 bytes; `.env.example` intentionally leaves this value blank. Then start the existing Compose services:

```powershell
docker compose up --build -d
```

Open `http://localhost:5173/register`, register with a new username/email/password, refresh the page to verify that the cookie restores the session, sign out, and confirm the signed-out header appears. Then sign in at `http://localhost:5173/login` using either username or email. Verify duplicate email/username and incorrect credentials produce safe, actionable messages.

Use `localhost` consistently in the browser. The default CORS allowlist is `http://localhost:5173`; using `127.0.0.1:5173` is a different browser origin and must also be added to `FRONTEND_ORIGINS` if desired.

For a database requiring the migration, take a backup first, then apply the exact checked-in file from PowerShell:

```powershell
docker exec uth-online-judge-postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" -Fc -f /tmp/uth-online-judge-before-auth.dump'
docker cp uth-online-judge-postgres:/tmp/uth-online-judge-before-auth.dump .\uth-online-judge-before-auth.dump
Get-Content -Raw .\backend\sql\migrations\001_authentication.sql | docker exec -i uth-online-judge-postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -'
```

Only run the migration once, after confirming the preflight counts are all zero. Do not drop or recreate the database. The migration invalidates legacy refresh sessions; it does not delete users or refresh-token rows.

Automated backend checks:

```powershell
npm --prefix backend run build
npm --prefix backend test
npm --prefix backend run test:e2e
```

Automated frontend checks:

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
```
