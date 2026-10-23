import { Inject, Injectable, Optional } from '@nestjs/common';
import { Judge0Client, type FetchFn } from './judge0.client.js';
import { JUDGE0_CONFIG, loadJudge0Config, type Judge0Config } from './judge0.config.js';
import { Judge0InvalidResponseError, Judge0TimeoutError } from './judge0.errors.js';
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
  private resolved?: { config: Judge0Config; client: Judge0Client };

  constructor(
    @Optional() @Inject(JUDGE0_CONFIG) private readonly injectedConfig?: Judge0Config,
    @Optional() @Inject(JUDGE0_FETCH) private readonly fetchFn?: FetchFn,
  ) {}

  // Resolved lazily so the app can boot (and tests can run) without JUDGE0_API_URL.
  private get deps(): { config: Judge0Config; client: Judge0Client } {
    if (!this.resolved) {
      const config = this.injectedConfig ?? loadJudge0Config();
      this.resolved = { config, client: new Judge0Client(config, this.fetchFn) };
    }
    return this.resolved;
  }

  async checkHealth(): Promise<Judge0About> {
    const data = await this.deps.client.request('GET', '/about');
    if (!isRecord(data) || typeof data.version !== 'string') {
      throw new Judge0InvalidResponseError('Unexpected /about response from Judge0.');
    }
    return { version: data.version };
  }

  async getLanguages(): Promise<Judge0Language[]> {
    const data = await this.deps.client.request('GET', '/languages');
    if (!Array.isArray(data)) throw new Judge0InvalidResponseError('Unexpected /languages response from Judge0.');
    return data.map((item) => {
      if (!isRecord(item) || typeof item.id !== 'number' || typeof item.name !== 'string') {
        throw new Judge0InvalidResponseError('Unexpected language entry from Judge0.');
      }
      return { id: item.id, name: item.name };
    });
  }

  async createSubmission(input: CreateJudge0SubmissionInput): Promise<string> {
    const body: Record<string, unknown> = {
      language_id: input.languageId,
      source_code: input.sourceCode,
    };
    if (input.stdin !== undefined) body.stdin = input.stdin;
    if (input.expectedOutput !== undefined) body.expected_output = input.expectedOutput;
    if (input.cpuTimeLimitSeconds !== undefined) body.cpu_time_limit = input.cpuTimeLimitSeconds;
    if (input.memoryLimitKb !== undefined) body.memory_limit = input.memoryLimitKb;

    const data = await this.deps.client.request('POST', '/submissions?base64_encoded=false&wait=false', body);
    if (!isRecord(data) || typeof data.token !== 'string' || !TOKEN_PATTERN.test(data.token)) {
      throw new Judge0InvalidResponseError('Judge0 did not return a valid submission token.');
    }
    return data.token;
  }

  async getSubmission(token: string): Promise<Judge0SubmissionResult> {
    if (!TOKEN_PATTERN.test(token)) throw new Judge0InvalidResponseError('Invalid Judge0 token.');
    const data = await this.deps.client.request('GET', `/submissions/${encodeURIComponent(token)}?base64_encoded=false`);
    return mapSubmission(token, data);
  }

  // Polls with a bounded number of attempts; never loops indefinitely.
  async waitForResult(token: string): Promise<Judge0SubmissionResult> {
    const { maxPollAttempts, pollIntervalMs } = this.deps.config;
    for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
      const result = await this.getSubmission(token);
      if (result.isFinished) return result;
      if (attempt < maxPollAttempts) await sleep(pollIntervalMs);
    }
    throw new Judge0TimeoutError(`Judge0 submission did not finish after ${maxPollAttempts} polls.`);
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
    case 7: case 8: case 9: case 10: case 11: case 12:
      return Judge0Verdict.RuntimeError;
    default:
      // 13 (Internal Error), 14 (Exec Format Error) and any unknown id
      return Judge0Verdict.InternalError;
  }
}

function mapSubmission(token: string, data: unknown): Judge0SubmissionResult {
  if (!isRecord(data) || !isRecord(data.status) || typeof data.status.id !== 'number') {
    throw new Judge0InvalidResponseError('Unexpected submission response from Judge0.');
  }
  const raw = data as Judge0RawSubmission;
  const statusId = data.status.id;
  const time = raw.time == null ? null : Number(raw.time);
  if (time !== null && !Number.isFinite(time)) {
    throw new Judge0InvalidResponseError('Judge0 returned an invalid time value.');
  }
  const verdict = mapVerdict(statusId);
  return {
    token,
    statusId,
    statusDescription: typeof data.status.description === 'string' ? data.status.description : '',
    verdict,
    isFinished: verdict !== Judge0Verdict.Pending,
    stdout: raw.stdout ?? null,
    stderr: raw.stderr ?? null,
    compileOutput: raw.compile_output ?? null,
    message: raw.message ?? null,
    timeSeconds: time,
    memoryKb: typeof raw.memory === 'number' ? raw.memory : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
