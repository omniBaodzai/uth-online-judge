import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
  AI_ASSISTANT_CONFIG,
  type AiAssistantConfig,
} from './ai-assistant.config.js';
import { AI_ASSISTANT_REDIS } from './ai-assistant.redis.js';
import type { AiAssistantPrincipal } from './ai-assistant.guest-identity.js';

const PREFIX = 'ai-assistant:';
const RATE_WINDOW_TTL_SECONDS = 7_200;

export type AiAssistantRateLimitCode =
  | 'GLOBAL_RATE_LIMIT'
  | 'IP_RATE_LIMIT'
  | 'RATE_LIMIT_MINUTE'
  | 'RATE_LIMIT_HOUR'
  | 'CONCURRENT_REQUEST'
  | 'PROVIDER_CONCURRENCY'
  | 'PROVIDER_DAILY_QUOTA';

export class AiAssistantRateLimitException extends HttpException {
  constructor(
    readonly code: AiAssistantRateLimitCode,
    readonly retryAfterSeconds: number,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code,
        message: 'UTH AI Assistant rate limit exceeded.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

const ACQUIRE_REQUEST_SCRIPT = `
local function increment(key, ttl)
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ttl) end
  return count
end

local function retryAtWindow(now, window)
  return math.max(1, math.ceil(((math.floor(now / window) + 1) * window - now) / 1000))
end

local globalCount = increment(KEYS[1], 120)
if globalCount > tonumber(ARGV[1]) then
  return {1, retryAtWindow(tonumber(ARGV[8]), 60000)}
end

local ipCount = increment(KEYS[2], 120)
if ipCount > tonumber(ARGV[2]) then
  return {2, retryAtWindow(tonumber(ARGV[8]), 60000)}
end

local identityCount = increment(KEYS[3], 120)
if identityCount > tonumber(ARGV[3]) then
  return {3, retryAtWindow(tonumber(ARGV[8]), 60000)}
end

if ARGV[4] == '1' then
  local hourlyCount = increment(KEYS[4], ${RATE_WINDOW_TTL_SECONDS})
  if hourlyCount > tonumber(ARGV[5]) then
    return {4, retryAtWindow(tonumber(ARGV[8]), 3600000)}
  end
end

local lockKey = KEYS[#KEYS]
redis.call('ZREMRANGEBYSCORE', lockKey, '-inf', ARGV[8])
if redis.call('ZCARD', lockKey) >= tonumber(ARGV[9]) then
  local oldest = redis.call('ZRANGE', lockKey, 0, 0, 'WITHSCORES')
  local retry = math.max(1, math.ceil((tonumber(oldest[2]) - tonumber(ARGV[8])) / 1000))
  return {5, retry}
end
redis.call(
  'ZADD',
  lockKey,
  tonumber(ARGV[8]) + tonumber(ARGV[6]),
  ARGV[7]
)
redis.call('PEXPIRE', lockKey, tonumber(ARGV[6]) + 1000)
return {0, 0}
`;

const RELEASE_IDENTITY_SCRIPT = `
return redis.call('ZREM', KEYS[1], ARGV[1])
`;

const RESERVE_PROVIDER_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retry = math.max(1, math.ceil((tonumber(oldest[2]) - tonumber(ARGV[1])) / 1000))
  return {1, retry}
end

local dailyCount = tonumber(redis.call('GET', KEYS[2]) or '0')
if dailyCount >= tonumber(ARGV[3]) then
  local retry = math.max(1, math.ceil((tonumber(ARGV[7]) - tonumber(ARGV[1])) / 1000))
  return {2, retry}
end

dailyCount = redis.call('INCR', KEYS[2])
if dailyCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[5]) end
redis.call('ZADD', KEYS[1], ARGV[1] + tonumber(ARGV[4]), ARGV[6])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]) + 1000)
return {0, 0}
`;

const RELEASE_PROVIDER_SCRIPT = `
return redis.call('ZREM', KEYS[1], ARGV[1])
`;

@Injectable()
export class AiAssistantRateLimit {
  constructor(
    @Inject(AI_ASSISTANT_REDIS)
    private readonly redis: Redis,
    @Inject(AI_ASSISTANT_CONFIG)
    private readonly config: AiAssistantConfig,
  ) {}

  async acquireRequest(
    principal: AiAssistantPrincipal,
    ipHash: string,
  ): Promise<() => Promise<void>> {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const identity = `${principal.kind}:${encodeURIComponent(principal.id)}`;
    const keys = [
      `${PREFIX}http:global:${minute}`,
      `${PREFIX}http:ip:${ipHash}:${minute}`,
      `${PREFIX}http:${identity}:minute:${minute}`,
    ];
    const hasHourlyLimit = principal.kind === 'guest';
    if (hasHourlyLimit) {
      keys.push(
        `${PREFIX}http:${identity}:hour:${Math.floor(now / 3_600_000)}`,
      );
    }

    const owner = randomUUID();
    const lockKey = `${PREFIX}identity-lock:${identity}`;
    keys.push(lockKey);
    const requestLockTtlMs = Math.max(this.config.timeoutMs + 30_000, 60_000);
    const result = await this.execute(ACQUIRE_REQUEST_SCRIPT, keys, [
      String(this.config.globalRequestsPerMinute),
      String(this.config.ipRequestsPerMinute),
      String(
        principal.kind === 'guest'
          ? this.config.guestRequestsPerMinute
          : this.config.userRequestsPerMinute,
      ),
      hasHourlyLimit ? '1' : '0',
      String(this.config.guestRequestsPerHour),
      String(requestLockTtlMs),
      owner,
      String(now),
      String(this.config.identityConcurrency),
    ]);

    const [statusValue, retryAfterValue] = Array.isArray(result)
      ? result
      : [result, 1];
    const status = Number(statusValue);
    if (status !== 0) {
      const codeByStatus: Record<number, AiAssistantRateLimitCode> = {
        1: 'GLOBAL_RATE_LIMIT',
        2: 'IP_RATE_LIMIT',
        3: 'RATE_LIMIT_MINUTE',
        4: 'RATE_LIMIT_HOUR',
        5: 'CONCURRENT_REQUEST',
      };
      throw new AiAssistantRateLimitException(
        codeByStatus[status] ?? 'RATE_LIMIT_MINUTE',
        Math.max(1, Number(retryAfterValue) || 1),
      );
    }

    return this.createRelease(RELEASE_IDENTITY_SCRIPT, [lockKey], [owner]);
  }

  async reserveProviderAttempt(): Promise<() => Promise<void>> {
    const now = Date.now();
    const owner = randomUUID();
    const leaseMs = Math.max(this.config.timeoutMs + 30_000, 60_000);
    const nextUtcDay = new Date(now);
    nextUtcDay.setUTCHours(24, 0, 0, 0);
    const dailyTtlSeconds =
      Math.ceil((nextUtcDay.getTime() - now) / 1_000) + 60;
    const dailyKey = `${PREFIX}provider:daily:${new Date(now)
      .toISOString()
      .slice(0, 10)}`;
    const activeKey = `${PREFIX}provider:in-flight`;
    const nextUtcDayTimestamp = nextUtcDay.getTime();
    const result = await this.execute(
      RESERVE_PROVIDER_SCRIPT,
      [activeKey, dailyKey],
      [
        String(now),
        String(this.config.globalProviderConcurrency),
        String(this.config.providerDailyAttempts),
        String(leaseMs),
        String(dailyTtlSeconds),
        owner,
        String(nextUtcDayTimestamp),
      ],
    );

    const [statusValue, retryAfterValue] = Array.isArray(result)
      ? result
      : [result, 1];
    const status = Number(statusValue);
    if (status === 1) {
      throw new AiAssistantRateLimitException(
        'PROVIDER_CONCURRENCY',
        Math.max(1, Number(retryAfterValue) || 1),
      );
    }
    if (status !== 0) {
      throw new AiAssistantRateLimitException(
        'PROVIDER_DAILY_QUOTA',
        Math.max(1, Number(retryAfterValue) || 1),
      );
    }

    return this.createRelease(RELEASE_PROVIDER_SCRIPT, [activeKey], [owner]);
  }

  private createRelease(
    script: string,
    keys: string[],
    args: string[],
  ): () => Promise<void> {
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      await this.execute(script, keys, args);
    };
  }

  private async execute(
    script: string,
    keys: string[],
    args: string[],
  ): Promise<unknown> {
    try {
      return await this.redis.eval(script, keys.length, ...keys, ...args);
    } catch {
      throw new ServiceUnavailableException(
        'UTH AI Assistant rate limiting is unavailable.',
      );
    }
  }
}
