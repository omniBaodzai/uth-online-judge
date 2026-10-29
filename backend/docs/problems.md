# Problems & Submissions API

Uses tables from `sql/migrations/002_problems_and_judging.sql` and the problem-language relation in `003_admin_support.sql`.

| Endpoint | Auth | Tables |
|---|---|---|
| `GET /problems` (page, pageSize≤50, search, tags, status, sort, order) | optional | problems, problem_tags, tags, submissions |
| `GET /problems/tags` | none | tags |
| `GET /problems/:code` | optional | problems, problem_test_cases (samples only), programming_languages, problem_editorials (flag only) |
| `GET /problems/:code/solution` | JWT + owned finalized submission | published problem_editorials |
| `POST /submissions` `{problemCode, language, sourceCode}` | JWT | submissions, submission_test_case_snapshots |
| `GET /submissions/:id` | JWT, owner only | submissions |

Only PUBLISHED problems are returned. The solution endpoint uses the user ID from the JWT and permits access after any submission reaches a final verdict; `PENDING`, `QUEUED`, and `RUNNING` do not qualify. Admin endpoints require an authenticated ADMIN role. Public problem/list APIs expose only the `hasSolution` flag, never editorial source code.
Submissions are stored and queued for asynchronous judging. Apply `006_submission_judging.sql` and `007_optional_problem_scoring.sql` before starting the judging-enabled backend with optional scoring.

Admins manage editorial solutions as the optional `editorials` collection in `POST /admin/problems` and `PATCH /admin/problems/:id`. Each item has an optional existing `id`, `title`, `language`, and `sourceCode`; saving the collection creates/updates the supplied items and removes omitted items in the same transaction as the problem. `GET /admin/problems/:id` includes the collection. All these routes use the shared JWT and ADMIN role guards.

## Problem scoring

- Scoring is controlled by the explicit `problems.scoring_enabled` flag; new problems default to disabled. A disabled problem is still judged and receives normal verdicts, test counts, execution time, and memory results.
- When scoring is enabled, the admin sets a positive maximum in `problems.score`; active hidden-test `points` must sum exactly to that maximum before publication or submissions. Public examples are never scored.
- Admins can assign decimal weights (up to two decimal places) per hidden test, or explicitly call `POST /admin/problems/:id/test-cases/distribute-points` to divide the maximum evenly. Any remainder cents go to earlier test positions; this action replaces existing hidden-test weights.
- Each submission snapshots `scoring_enabled`, test points, and the problem maximum at submission time. The submission score is exactly the sum of points awarded to accepted tests. Later problem edits do not change historical submissions or scores.
- Apply `007_optional_problem_scoring.sql` after migration 006. It adds explicit flags without changing score values, test points, snapshots, or historical results. The legacy judging path always used scoring, so existing problem and submission rows are migrated as scored; only new rows default to unscored. The migration is additive and must be run manually.
- There is one scoring source only: configured hidden-test points, copied into submission snapshots and then aggregated as the submission score. No separate reward ledger or reward-points balance exists.
- Future rankings should group eligible submissions by user and problem, take `MAX(submissions.score)` per group, then sum those best scores; repeated attempts must not add together. If scoring configuration can change after submissions exist, rankings must define a version policy first: preserve each historical score against its immutable snapshot, and either freeze scoring after the first submission or add an explicit scoring-version identifier and select comparable versions. Never reinterpret or rejudge old scores silently.

## Programming languages

- Admins can query the live Judge0 catalog with `GET /admin/languages/judge0` and enable a language with `POST /admin/languages` using its Judge0 `judge0LanguageId`.
- The backend stores the Judge0 ID and a unique application slug. Existing language slugs are preserved when an already-configured Judge0 ID is re-enabled.
- The admin problem form assigns enabled catalog languages to each problem. Student problem details expose only that problem's enabled language slugs; `POST /submissions` validates the selected slug against the problem-language relation.

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

- Comments have no table (shown as unavailable).
- `SubmissionsPage` still uses mock data.
- No rate limit on submissions.
- Problems without enabled language associations or active test cases cannot accept submissions.
- Scored published problems with no hidden tests or a hidden-test point total that differs from the maximum cannot accept submissions; unscored problems have no point-total requirement.
- Invalid token on optional-auth routes is treated as anonymous.
- Frontend has no test framework; only build/lint were run.
