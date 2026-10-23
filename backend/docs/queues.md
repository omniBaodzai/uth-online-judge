# BullMQ demo queue

## Submission judging queue

The `judging` queue is registered alongside the existing demo queue and is consumed by `JudgingProcessor` in the NestJS backend. `POST /submissions` stores the submission and an immutable snapshot of active test cases and problem limits in one PostgreSQL transaction, then enqueues only `{ submissionId }`. On startup, `JudgingRecoveryService` re-enqueues pending/queued submissions with snapshots using the same idempotent job ID; legacy pending submissions are snapshotted by the migration, while those without active test cases are marked `INTERNAL_ERROR` instead of remaining stuck. The worker is bounded by `JUDGING_CONCURRENCY` (default 2, maximum 8), uses three exponential-backoff attempts for transient failures, and creates/polls Judge0 CE batch submissions in bounded groups controlled by `JUDGING_BATCH_SIZE` (default 3, maximum 4). Each Judge0 test remains an isolated submission with its own verdict and snapshot; batches only reduce request/poll round trips and allow Judge0 to schedule cases concurrently. Polling uses `JUDGE0_POLL_INTERVAL_MS` (default 500 ms) with bounded backoff up to 3 seconds, and a per-batch CPU limit plus a 30-second grace period (hard cap 12 minutes). If a batch remains queued or processing until its deadline, completed case results and score remain persisted and unfinished snapshots are finalized as internal errors. Compilation errors stop creation of subsequent batches; remaining cases are recorded as compilation errors. Transient failures retry with per-case upserts; already completed snapshot results are skipped to avoid re-execution and duplicate scoring.

Submission and worker logs include elapsed durations for enqueue, queue wait, database stages, Judge0 HTTP/poll time, Judge0-reported submission lifetime, execution/wall time, and worker total time. The submission details page emits request and response-to-render timings to the browser console in development only. Logs deliberately omit source code, test inputs, expected outputs, and Judge0 tokens.

Apply `backend/sql/migrations/006_submission_judging.sql` before starting the updated backend. It adds the submission-time maximum score and immutable test-case snapshots; existing results are backfilled without deleting submission data. Snapshot inputs and expected outputs are backend-only and are never returned by student-facing submission queries.

Judge0 CE statuses 7–12 remain runtime errors. This integration does not infer memory-limit errors from approximate memory usage.

New submissions move through `PENDING` → `QUEUED` → `RUNNING` → terminal verdict. Queue enqueue errors are recorded as `INTERNAL_ERROR`; exhausted job retries retain already persisted per-case results and finalize the submission as `INTERNAL_ERROR`.

## Concepts
- **Redis**: the in-memory store where BullMQ keeps all queue data. Only the backend talks to it (internal Docker network, port not published).
- **Queue** (`demo`): a named list of pending work. The backend *adds* jobs to it.
- **Job** (`uppercase-text`): one unit of work: a name plus data (`{ text }`). Its state moves waiting → active → completed/failed.
- **Worker** (`DemoQueueProcessor`): takes jobs from the queue and runs `process()`. It runs inside the NestJS backend process and is closed automatically on shutdown.

## Path of a job
1. `POST /demo-queue/uppercase` (JWT required, body validated by `EnqueueUppercaseDto`) → `DemoQueueController`.
2. `DemoQueueService.enqueueUppercase` calls `queue.add(...)` with a random UUID id, 3 attempts, exponential backoff (1 s base) and bounded retention (completed: 1 h/100 jobs, failed: 24 h/100 jobs). Returns `202 { jobId }` - this only means "queued".
3. Redis stores the job. `DemoQueueProcessor.process` receives it and returns `{ text: UPPERCASED }`; BullMQ stores the result.
4. `GET /demo-queue/jobs/:jobId` returns the state, and `result` only once the state is `completed`.

## Files
Created in `backend/src/queues/`: `demo-queue.constants.ts` (names/types), `demo-queue.module.ts` (Redis connection + queue registration), `demo-queue.service.ts` (enqueue/status), `demo-queue.processor.ts` (worker), `demo-queue.controller.ts` (HTTP), `dto/enqueue-uppercase.dto.ts` (validation), plus `*.spec.ts` tests. Modified: `src/app.module.ts` (imports `DemoQueueModule`). Also this doc.

## Run (PowerShell, repo root)
```powershell
docker compose up -d --build
docker compose ps
```
Submit a job (replace credentials; `$token` is the access token returned by `/auth/login`):
```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login -ContentType 'application/json' -Body (@{ identifier = 'YOUR_USER'; password = 'YOUR_PASSWORD' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$job = Invoke-RestMethod -Method Post -Uri http://localhost:3000/demo-queue/uppercase -Headers $headers -ContentType 'application/json' -Body (@{ text = 'hello uth' } | ConvertTo-Json)
Invoke-RestMethod -Uri "http://localhost:3000/demo-queue/jobs/$($job.jobId)" -Headers $headers
```
(Adjust the token property name if your login response differs.) Confirm in the logs:
```powershell
docker compose logs backend --tail 50
```
Look for `Enqueued uppercase-text job <id>` followed by `Processed uppercase-text job <id>`.

## Tests
```powershell
cd backend
npm test
```
Unit tests mock the queue and need no Redis. On a cold start the first run can hit the 10 s hook timeout; rerun or add `--hookTimeout 60000`.

## Common problems
- `Cannot find module '@nestjs/bullmq'` / `bullmq` / `ioredis` in `docker compose logs backend`: the `backend_node_modules` volume predates the dependency. Run `docker compose exec backend npm install`, then `docker compose restart backend` (no volume deletion needed).
- `BullMQ could not load the optional 'ioredis' package`: BullMQ 6 does not bundle `ioredis`; it is a direct dependency here and the module passes a client instance (required under native ESM).
- `REDIS_HOST must be configured`: set `REDIS_HOST=redis` (already in `docker-compose.yml`). Outside Docker, set it to the host where Redis is reachable.
- `ECONNREFUSED redis:6379` / `503` on enqueue: Redis is not running or unhealthy - `docker compose ps`, `docker compose logs redis`.
- `ENOTFOUND redis` when running `npm run start` on the host: the name `redis` only resolves inside Compose.
- `404` on job status: the job expired (retention) or the id is wrong.
- `401`: missing or expired access token.
