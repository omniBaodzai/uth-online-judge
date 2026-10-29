import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Judge0Client, type FetchFn } from './judge0.client.js';
import {
  JUDGE0_CONFIG,
  loadJudge0Config,
  type Judge0Config,
} from './judge0.config.js';
import {
  Judge0InvalidResponseError,
  Judge0SubmissionTimeoutError,
} from './judge0.errors.js';
import {
  JUDGE0_STATUS,
  Judge0Verdict,
  type CreateJudge0SubmissionInput,
  type Judge0About,
  type Judge0Language,
  type Judge0RawSubmission,
  type Judge0SubmissionResult,
} from './judge0.types.js';

export const JUDGE0_FETCH = 'JUDGE0_FETCH';

const TOKEN_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

@Injectable()
export class Judge0Service {
  private readonly logger = new Logger(Judge0Service.name);
  private resolved?: { config: Judge0Config; client: Judge0Client };

  constructor(
    @Optional()
    @Inject(JUDGE0_CONFIG)
    private readonly injectedConfig?: Judge0Config,
    @Optional() @Inject(JUDGE0_FETCH) private readonly fetchFn?: FetchFn,
  ) {}

  // Resolved lazily so the app can boot (and tests can run) without JUDGE0_API_URL.
  private get deps(): { config: Judge0Config; client: Judge0Client } {
    if (!this.resolved) {
      const config = this.injectedConfig ?? loadJudge0Config();
      this.resolved = {
        config,
        client: new Judge0Client(config, this.fetchFn),
      };
    }
    return this.resolved;
  }

  async checkHealth(): Promise<Judge0About> {
    const data = await this.deps.client.request('GET', '/about');
    if (!isRecord(data) || typeof data.version !== 'string') {
      throw new Judge0InvalidResponseError(
        'Unexpected /about response from Judge0.',
      );
    }
    return { version: data.version };
  }

  async getLanguages(): Promise<Judge0Language[]> {
    const data = await this.deps.client.request('GET', '/languages');
    if (!Array.isArray(data))
      throw new Judge0InvalidResponseError(
        'Unexpected /languages response from Judge0.',
      );
    return data.map((item) => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'number' ||
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        typeof item.name !== 'string' ||
        !item.name.trim()
      ) {
        throw new Judge0InvalidResponseError(
          'Unexpected language entry from Judge0.',
        );
      }
      return { id: item.id, name: item.name };
    });
  }

  async createSubmission(input: CreateJudge0SubmissionInput): Promise<string> {
    const startedAt = performance.now();
    const data = await this.deps.client.request(
      'POST',
      '/submissions?base64_encoded=false&wait=false',
      toJudge0Submission(input),
    );
    if (
      !isRecord(data) ||
      typeof data.token !== 'string' ||
      !TOKEN_PATTERN.test(data.token)
    ) {
      throw new Judge0InvalidResponseError(
        'Judge0 did not return a valid submission token.',
      );
    }
    this.logger.log(`Judge0 create request httpMs=${elapsedMs(startedAt)}`);
    return data.token;
  }

  async createSubmissionBatch(
    inputs: CreateJudge0SubmissionInput[],
  ): Promise<string[]> {
    if (inputs.length === 0 || inputs.length > 4) {
      throw new Judge0InvalidResponseError(
        'Judge0 batch size must be between 1 and 4.',
      );
    }
    const startedAt = performance.now();
    const data = await this.deps.client.request(
      'POST',
      '/submissions/batch?base64_encoded=false',
      { submissions: inputs.map(toJudge0Submission) },
    );
    if (!Array.isArray(data) || data.length !== inputs.length) {
      throw new Judge0InvalidResponseError(
        'Judge0 returned invalid batch submission tokens.',
      );
    }
    const tokens: string[] = [];
    for (const item of data) {
      if (
        !isRecord(item) ||
        typeof item.token !== 'string' ||
        !TOKEN_PATTERN.test(item.token)
      ) {
        throw new Judge0InvalidResponseError(
          'Judge0 returned invalid batch submission tokens.',
        );
      }
      tokens.push(item.token);
    }
    if (new Set(tokens).size !== tokens.length) {
      throw new Judge0InvalidResponseError(
        'Judge0 returned duplicate batch submission tokens.',
      );
    }
    this.logger.log(
      `Judge0 batch create count=${tokens.length} httpMs=${elapsedMs(startedAt)}`,
    );
    return tokens;
  }

  async getSubmission(token: string): Promise<Judge0SubmissionResult> {
    if (!TOKEN_PATTERN.test(token))
      throw new Judge0InvalidResponseError('Invalid Judge0 token.');
    const data = await this.deps.client.request(
      'GET',
      `/submissions/${encodeURIComponent(token)}?base64_encoded=false&fields=token,status,stdout,stderr,compile_output,message,time,wall_time,memory,created_at,finished_at`,
    );
    return mapSubmission(token, data);
  }

  // Polls with a bounded number of attempts; never loops indefinitely.
  async waitForResult(
    token: string,
    timeoutMs?: number,
  ): Promise<Judge0SubmissionResult> {
    const { maxPollAttempts, pollIntervalMs } = this.deps.config;
    const deadline =
      timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
    const effectivePollIntervalMs = Math.max(500, pollIntervalMs);
    const attemptsForTimeout =
      timeoutMs === undefined
        ? maxPollAttempts
        : Math.min(
            720,
            Math.max(
              maxPollAttempts,
              Math.ceil(timeoutMs / effectivePollIntervalMs),
            ),
          );
    const startedAt = performance.now();
    let requestMs = 0;

    for (let attempt = 1; attempt <= attemptsForTimeout; attempt += 1) {
      if (deadline !== undefined && Date.now() >= deadline) break;
      const requestStartedAt = performance.now();
      const result = await this.getSubmission(token);
      requestMs += elapsedMs(requestStartedAt);
      if (result.isFinished) {
        this.logger.log(
          `Judge0 poll finished verdict=${result.verdict} polls=${attempt} pollElapsedMs=${elapsedMs(startedAt)} httpMs=${requestMs} judge0DurationMs=${result.submissionDurationMs ?? 'unknown'} executionMs=${toMs(result.timeSeconds)} wallMs=${toMs(result.wallTimeSeconds)}`,
        );
        return result;
      }
      if (attempt < attemptsForTimeout) {
        const remainingMs =
          deadline === undefined
            ? nextPollDelay(pollIntervalMs, attempt)
            : Math.max(0, deadline - Date.now());
        if (remainingMs > 0) {
          await sleep(
            Math.min(nextPollDelay(pollIntervalMs, attempt), remainingMs),
          );
        }
      }
    }
    this.logger.warn(
      `Judge0 poll deadline reached polls=${attemptsForTimeout} pollElapsedMs=${elapsedMs(startedAt)} httpMs=${requestMs}`,
    );
    throw new Judge0SubmissionTimeoutError(
      `Judge0 submission did not finish after ${attemptsForTimeout} polls.`,
    );
  }

  async waitForResults(
    tokens: string[],
    timeoutMs: number,
    onCompleted?: (results: Judge0SubmissionResult[]) => Promise<void>,
  ): Promise<{ results: Judge0SubmissionResult[]; timedOut: boolean }> {
    if (
      tokens.length === 0 ||
      tokens.length > 4 ||
      tokens.some((token) => !TOKEN_PATTERN.test(token)) ||
      new Set(tokens).size !== tokens.length
    ) {
      throw new Judge0InvalidResponseError(
        'Invalid Judge0 batch polling tokens.',
      );
    }

    const { maxPollAttempts, pollIntervalMs } = this.deps.config;
    const intervalMs = Math.max(500, pollIntervalMs);
    const deadline = Date.now() + timeoutMs;
    const maxAttempts = Math.min(
      720,
      Math.max(maxPollAttempts, Math.ceil(timeoutMs / intervalMs)),
    );
    const startedAt = performance.now();
    let requestMs = 0;
    let attempts = 0;
    const completed = new Set<string>();
    const latest = new Map<string, Judge0SubmissionResult>();

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (Date.now() >= deadline) break;
      attempts += 1;
      const pendingTokens = tokens.filter((token) => !completed.has(token));
      const query = new URLSearchParams({
        tokens: pendingTokens.join(','),
        base64_encoded: 'false',
        fields: 'token,status,time,wall_time,memory,created_at,finished_at',
      });
      const requestStartedAt = performance.now();
      const data = await this.deps.client.request(
        'GET',
        `/submissions/batch?${query}`,
      );
      requestMs += elapsedMs(requestStartedAt);
      const batch = parseBatchResults(data, pendingTokens);
      const newlyCompleted: Judge0SubmissionResult[] = [];

      for (const result of batch) {
        latest.set(result.token, result);
        if (result.isFinished) {
          completed.add(result.token);
          newlyCompleted.push(result);
        }
      }
      if (newlyCompleted.length > 0 && onCompleted)
        await onCompleted(newlyCompleted);

      if (completed.size === tokens.length) {
        this.logger.log(
          `Judge0 batch poll finished count=${tokens.length} polls=${attempts} pollElapsedMs=${elapsedMs(startedAt)} httpMs=${requestMs} judge0LifetimeMs=${sumMetric(tokens.map((token) => latest.get(token)?.submissionDurationMs ?? null))} executionMs=${sumMetric(tokens.map((token) => toMsNumber(latest.get(token)?.timeSeconds ?? null)))} wallMs=${sumMetric(tokens.map((token) => toMsNumber(latest.get(token)?.wallTimeSeconds ?? null)))}`,
        );
        return {
          results: tokens.map((token) => latest.get(token)!),
          timedOut: false,
        };
      }

      if (attempt < maxAttempts) {
        const remainingMs = Math.max(0, deadline - Date.now());
        if (remainingMs > 0) {
          await sleep(
            Math.min(nextPollDelay(pollIntervalMs, attempt), remainingMs),
          );
        }
      }
    }

    const timedOut = completed.size !== tokens.length;
    this.logger.warn(
      `Judge0 batch poll ${timedOut ? 'deadline reached' : 'finished'} count=${tokens.length} completed=${completed.size} polls=${attempts} pollElapsedMs=${elapsedMs(startedAt)} httpMs=${requestMs}`,
    );
    return {
      results: tokens.map((token) => latest.get(token)).filter(isDefined),
      timedOut,
    };
  }
}

export function mapVerdict(statusId: number): Judge0Verdict {
  switch (statusId) {
    case JUDGE0_STATUS.IN_QUEUE:
    case JUDGE0_STATUS.PROCESSING:
      return Judge0Verdict.Pending;
    case JUDGE0_STATUS.ACCEPTED:
      return Judge0Verdict.Accepted;
    case JUDGE0_STATUS.WRONG_ANSWER:
      return Judge0Verdict.WrongAnswer;
    case JUDGE0_STATUS.TIME_LIMIT_EXCEEDED:
      return Judge0Verdict.TimeLimitExceeded;
    case JUDGE0_STATUS.COMPILATION_ERROR:
      return Judge0Verdict.CompilationError;
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return Judge0Verdict.RuntimeError;
    default:
      // 13 (Internal Error), 14 (Exec Format Error) and any unknown id
      return Judge0Verdict.InternalError;
  }
}

function mapSubmission(token: string, data: unknown): Judge0SubmissionResult {
  if (
    !isRecord(data) ||
    !isRecord(data.status) ||
    typeof data.status.id !== 'number'
  ) {
    throw new Judge0InvalidResponseError(
      'Unexpected submission response from Judge0.',
    );
  }
  const raw = data as Judge0RawSubmission;
  const statusId = data.status.id;
  const time = raw.time == null ? null : Number(raw.time);
  const wallTime = raw.wall_time == null ? null : Number(raw.wall_time);
  if (
    (time !== null && (!Number.isFinite(time) || time < 0)) ||
    (wallTime !== null && (!Number.isFinite(wallTime) || wallTime < 0))
  ) {
    throw new Judge0InvalidResponseError(
      'Judge0 returned an invalid execution time value.',
    );
  }
  const verdict = mapVerdict(statusId);
  return {
    token,
    statusId,
    statusDescription:
      typeof data.status.description === 'string'
        ? data.status.description
        : '',
    verdict,
    isFinished: verdict !== Judge0Verdict.Pending,
    stdout: raw.stdout ?? null,
    stderr: raw.stderr ?? null,
    compileOutput: raw.compile_output ?? null,
    message: raw.message ?? null,
    timeSeconds: time,
    wallTimeSeconds: wallTime,
    memoryKb: typeof raw.memory === 'number' ? raw.memory : null,
    submissionDurationMs: durationBetween(raw.created_at, raw.finished_at),
  };
}

function toJudge0Submission(
  input: CreateJudge0SubmissionInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    language_id: input.languageId,
    source_code: input.sourceCode,
  };
  if (input.stdin !== undefined) body.stdin = input.stdin;
  if (input.expectedOutput !== undefined)
    body.expected_output = input.expectedOutput;
  if (input.cpuTimeLimitSeconds !== undefined)
    body.cpu_time_limit = input.cpuTimeLimitSeconds;
  if (input.memoryLimitKb !== undefined)
    body.memory_limit = input.memoryLimitKb;
  return body;
}

function parseBatchResults(
  data: unknown,
  expectedTokens: string[],
): Judge0SubmissionResult[] {
  if (!isRecord(data) || !Array.isArray(data.submissions)) {
    throw new Judge0InvalidResponseError('Unexpected Judge0 batch response.');
  }
  const byToken = new Map<string, Judge0SubmissionResult>();
  for (const item of data.submissions) {
    if (
      !isRecord(item) ||
      typeof item.token !== 'string' ||
      !TOKEN_PATTERN.test(item.token)
    ) {
      throw new Judge0InvalidResponseError(
        'Judge0 returned an invalid batch result token.',
      );
    }
    if (byToken.has(item.token)) {
      throw new Judge0InvalidResponseError(
        'Judge0 returned duplicate batch result tokens.',
      );
    }
    byToken.set(item.token, mapSubmission(item.token, item));
  }
  if (
    byToken.size !== expectedTokens.length ||
    expectedTokens.some((token) => !byToken.has(token))
  ) {
    throw new Judge0InvalidResponseError(
      'Judge0 batch response did not contain each requested token exactly once.',
    );
  }
  return expectedTokens.map((token) => byToken.get(token)!);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function durationBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? endMs - startMs
    : null;
}

function nextPollDelay(baseMs: number, attempt: number): number {
  const exponent = Math.min(Math.max(attempt - 1, 0), 4);
  return Math.min(3_000, Math.max(500, baseMs) * 2 ** exponent);
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function toMs(seconds: number | null): number | 'unknown' {
  return seconds === null ? 'unknown' : Math.round(seconds * 1000);
}

function toMsNumber(seconds: number | null): number | null {
  return seconds === null ? null : Math.round(seconds * 1000);
}

function sumMetric(values: Array<number | null>): number | 'unknown' {
  return values.some((value) => value === null)
    ? 'unknown'
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
