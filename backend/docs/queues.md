# BullMQ demo queue

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
