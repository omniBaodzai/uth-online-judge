import { Judge0ConfigError } from './judge0.errors.js';

export const JUDGE0_CONFIG = 'JUDGE0_CONFIG';

export interface Judge0Config {
  baseUrl: string;
  requestTimeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadJudge0Config(env: NodeJS.ProcessEnv = process.env): Judge0Config {
  const raw = env.JUDGE0_API_URL?.trim();
  if (!raw) throw new Judge0ConfigError('JUDGE0_API_URL is not configured.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Judge0ConfigError('JUDGE0_API_URL is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Judge0ConfigError('JUDGE0_API_URL must use http or https.');
  }
  return {
    baseUrl: raw.replace(/\/+$/, ''),
    requestTimeoutMs: positiveInt(env.JUDGE0_REQUEST_TIMEOUT_MS, 10_000),
    pollIntervalMs: positiveInt(env.JUDGE0_POLL_INTERVAL_MS, 100),
    maxPollAttempts: positiveInt(env.JUDGE0_MAX_POLL_ATTEMPTS, 30),
  };
}
