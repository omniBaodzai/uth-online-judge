# Problems & Submissions API

No migration needed: uses tables from `sql/migrations/002_problems_and_judging.sql`.

| Endpoint | Auth | Tables |
|---|---|---|
| `GET /problems` (page, pageSize≤50, search, tags, status, sort, order) | optional | problems, problem_tags, tags, submissions |
| `GET /problems/tags` | none | tags |
| `GET /problems/:code` | optional | problems, problem_test_cases (samples only), programming_languages, problem_editorials (flag only) |
| `POST /submissions` `{problemCode, language, sourceCode}` | JWT | submissions |
| `GET /submissions/:id` | JWT, owner only | submissions |

Only PUBLISHED problems are returned (no admin/role model yet). Hidden tests and editorial content are never exposed.
Submissions are stored as `PENDING`; there is no judging (no Judge0, no code execution).

## Dev data (manual, never auto-run)

```powershell
Get-Content backend\sql\seeds\dev_problems.sql | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Requires at least one registered user. Creates UTH001 (published) and UTH900 (draft).

## Verify

- Backend: `cd backend; npm run build; npm run lint; npx vitest run --hookTimeout 60000`
- Frontend: `cd frontend; npm run build; npm run lint`
- Open `/problems`, `/problems/UTH001`, then submit code while logged in.

## Limitations

- Solution page is still a placeholder; comments have no table (shown as unavailable).
- `SubmissionsPage` still uses mock data.
- No rate limit on submissions.
- Language slug must match the seed (cpp, java, python, javascript).
- Invalid token on optional-auth routes is treated as anonymous.
- Frontend has no test framework; only build/lint were run.
