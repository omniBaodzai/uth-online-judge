import { randomUUID } from 'node:crypto';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { AiAssistantConfig } from './ai-assistant.config.js';
import { AiAssistantRateLimit } from './ai-assistant.rate-limit.js';

const enabled = process.env.AI_ASSISTANT_REDIS_INTEGRATION === 'true';
const createdKeys = new Set<string>();

const baseConfig: AiAssistantConfig = {
  enabled: true,
  apiKey: '',
  model: '',
  timeoutMs: 1_000,
  maxOutputTokens: 100,
  guestCookieSecret: 'integration-test-secret-with-at-least-32-bytes',
  guestCookieTtlSeconds: 86_400,
  guestCookieSecure: false,
  guestRequestsPerMinute: 10,
  guestRequestsPerHour: 60,
  userRequestsPerMinute: 20,
  identityConcurrency: 1,
  ipRequestsPerMinute: 300,
  globalRequestsPerMinute: 300,
  globalProviderConcurrency: 4,
  providerDailyAttempts: 200,
};

function createRedisClient() {
  return new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    lazyConnect: true,
    connectTimeout: 3_000,
    commandTimeout: 3_500,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
}

function createTestLimiter(
  client: Redis,
  config: Partial<AiAssistantConfig> = {},
  namespace = `ai-assistant:test:${randomUUID()}:`,
) {
  const isolatedClient = new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'eval') {
        return (script: string, keyCount: number, ...args: string[]) => {
          const isolatedKeys = args
            .slice(0, keyCount)
            .map((key) => `${namespace}${key}`);
          isolatedKeys.forEach((key) => createdKeys.add(key));
          return target.eval(
            script,
            keyCount,
            ...isolatedKeys,
            ...args.slice(keyCount),
          );
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Redis;

  return new AiAssistantRateLimit(isolatedClient, {
    ...baseConfig,
    ...config,
  });
}

async function consumeRequest(
  limiter: AiAssistantRateLimit,
  principal: { kind: 'guest' | 'user'; id: string },
  ipHash: string,
) {
  const release = await limiter.acquireRequest(principal, ipHash);
  await release();
}

async function tryRequest(
  limiter: AiAssistantRateLimit,
  principal: { kind: 'guest' | 'user'; id: string },
  ipHash: string,
): Promise<boolean> {
  try {
    await consumeRequest(limiter, principal, ipHash);
    return true;
  } catch (error) {
    if (error instanceof HttpException && error.getStatus() === 429) {
      return false;
    }
    throw error;
  }
}

describe.skipIf(!enabled)('AiAssistantRateLimit Redis integration', () => {
  let client: Redis;

  beforeAll(async () => {
    client = createRedisClient();
    await client.connect();
    expect(await client.ping()).toBe('PONG');
  });

  afterEach(async () => {
    if (createdKeys.size > 0) {
      const keys = [...createdKeys];
      for (let index = 0; index < keys.length; index += 100) {
        await client.unlink(...keys.slice(index, index + 100));
      }
      createdKeys.clear();
    }
  });

  afterAll(() => {
    client?.disconnect();
  });

  it('enforces guest minute and hour buckets and expires counters', async () => {
    const minuteLimiter = createTestLimiter(client, {
      guestRequestsPerMinute: 10,
      guestRequestsPerHour: 120,
    });
    const guest = { kind: 'guest' as const, id: 'guest-minute' };

    for (let index = 0; index < 10; index += 1) {
      await consumeRequest(minuteLimiter, guest, 'minute-ip');
    }
    await expect(
      minuteLimiter.acquireRequest(guest, 'minute-ip'),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: 'RATE_LIMIT_MINUTE',
        retryAfterSeconds: expect.any(Number),
      },
    });

    const minuteKey = [...createdKeys].find((key) =>
      key.includes(':http:guest:guest-minute:minute:'),
    );
    expect(minuteKey).toBeDefined();
    expect(await client.get(minuteKey!)).toBe('11');
    expect(await client.ttl(minuteKey!)).toBeGreaterThan(0);
    expect(await client.ttl(minuteKey!)).toBeLessThanOrEqual(120);

    const hourLimiter = createTestLimiter(client, {
      guestRequestsPerMinute: 61,
      guestRequestsPerHour: 60,
    });
    const hourlyGuest = { kind: 'guest' as const, id: 'guest-hour' };

    for (let index = 0; index < 60; index += 1) {
      await consumeRequest(hourLimiter, hourlyGuest, 'hour-ip');
    }
    await expect(
      hourLimiter.acquireRequest(hourlyGuest, 'hour-ip'),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: 'RATE_LIMIT_HOUR',
        retryAfterSeconds: expect.any(Number),
      },
    });

    const hourKey = [...createdKeys].find((key) =>
      key.includes(':http:guest:guest-hour:hour:'),
    );
    expect(hourKey).toBeDefined();
    expect(await client.get(hourKey!)).toBe('61');
    expect(await client.ttl(hourKey!)).toBeGreaterThan(0);
    expect(await client.ttl(hourKey!)).toBeLessThanOrEqual(7_200);
  }, 15_000);

  it('enforces authenticated minute limits', async () => {
    const limiter = createTestLimiter(client, {
      userRequestsPerMinute: 20,
    });
    const user = { kind: 'user' as const, id: 'authenticated-user' };

    for (let index = 0; index < 20; index += 1) {
      await consumeRequest(limiter, user, 'user-ip');
    }
    await expect(limiter.acquireRequest(user, 'user-ip')).rejects.toMatchObject(
      {
        status: 429,
        response: {
          code: 'RATE_LIMIT_MINUTE',
          retryAfterSeconds: expect.any(Number),
        },
      },
    );
  });

  it('applies global and IP counters atomically under parallel requests', async () => {
    const namespace = `ai-assistant:test:${randomUUID()}:`;
    const clients = Array.from({ length: 4 }, createRedisClient);
    try {
      await Promise.all(clients.map((redisClient) => redisClient.connect()));
      const limiters = clients.map((redisClient) =>
        createTestLimiter(
          redisClient,
          {
            globalRequestsPerMinute: 300,
            ipRequestsPerMinute: 100,
          },
          namespace,
        ),
      );
      const globalResults = await Promise.all(
        Array.from({ length: 301 }, (_, index) =>
          tryRequest(
            limiters[index % limiters.length]!,
            { kind: 'user', id: `global-user-${index}` },
            `global-ip-${index}`,
          ),
        ),
      );

      expect(globalResults.filter(Boolean)).toHaveLength(300);
      const globalKey = [...createdKeys].find((key) =>
        key.includes(':http:global:'),
      );
      expect(globalKey).toBeDefined();
      expect(await client.get(globalKey!)).toBe('301');
      expect(await client.ttl(globalKey!)).toBeGreaterThan(0);
      expect(await client.ttl(globalKey!)).toBeLessThanOrEqual(120);
      await expect(
        limiters[0]!.acquireRequest(
          { kind: 'user', id: 'global-over-limit' },
          'global-ip-over-limit',
        ),
      ).rejects.toMatchObject({
        response: { code: 'GLOBAL_RATE_LIMIT' },
      });
    } finally {
      clients.forEach((redisClient) => redisClient.disconnect());
    }

    const ipLimiter = createTestLimiter(client, {
      globalRequestsPerMinute: 1_000,
      ipRequestsPerMinute: 300,
    });
    const ipResults = await Promise.all(
      Array.from({ length: 301 }, (_, index) =>
        tryRequest(
          ipLimiter,
          { kind: 'user', id: `ip-user-${index}` },
          'shared-ip',
        ),
      ),
    );
    expect(ipResults.filter(Boolean)).toHaveLength(300);

    const ipKey = [...createdKeys].find((key) =>
      key.includes(':http:ip:shared-ip:'),
    );
    expect(ipKey).toBeDefined();
    expect(await client.get(ipKey!)).toBe('301');
    expect(await client.ttl(ipKey!)).toBeGreaterThan(0);
    await expect(
      ipLimiter.acquireRequest(
        { kind: 'user', id: 'ip-over-limit' },
        'shared-ip',
      ),
    ).rejects.toMatchObject({
      response: { code: 'IP_RATE_LIMIT' },
    });
  }, 30_000);

  it('enforces one in-flight request per identity', async () => {
    const limiter = createTestLimiter(client, {
      identityConcurrency: 1,
      userRequestsPerMinute: 100,
    });
    const user = { kind: 'user' as const, id: 'single-flight-user' };
    const release = await limiter.acquireRequest(user, 'single-flight-ip');

    await expect(
      limiter.acquireRequest(user, 'single-flight-ip'),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: 'CONCURRENT_REQUEST',
        retryAfterSeconds: expect.any(Number),
      },
    });

    await release();
    await consumeRequest(limiter, user, 'single-flight-ip');
  });

  it('accepts a guest request immediately after a completed request releases its slot', async () => {
    const limiter = createTestLimiter(client);
    const guest = { kind: 'guest' as const, id: 'completed-guest' };

    await consumeRequest(limiter, guest, 'completed-ip');
    const lockKey = [...createdKeys].find((key) =>
      key.endsWith(':identity-lock:guest:completed-guest'),
    );
    expect(lockKey).toBeDefined();
    expect(await client.zcard(lockKey!)).toBe(0);

    const releaseSecond = await limiter.acquireRequest(guest, 'completed-ip');
    expect(await client.zcard(lockKey!)).toBe(1);
    await releaseSecond();
    expect(await client.zcard(lockKey!)).toBe(0);

    const minuteKey = [...createdKeys].find((key) =>
      key.includes(':http:guest:completed-guest:minute:'),
    );
    const hourKey = [...createdKeys].find((key) =>
      key.includes(':http:guest:completed-guest:hour:'),
    );
    expect(await client.get(minuteKey!)).toBe('2');
    expect(await client.get(hourKey!)).toBe('2');
  });

  it('releases identity leases by owner without removing another lease', async () => {
    const limiter = createTestLimiter(client, {
      identityConcurrency: 2,
      userRequestsPerMinute: 100,
    });
    const user = { kind: 'user' as const, id: 'lease-owner' };
    const releaseFirst = await limiter.acquireRequest(user, 'lease-ip');
    const releaseSecond = await limiter.acquireRequest(user, 'lease-ip');
    const lockKey = [...createdKeys].find((key) =>
      key.endsWith(':identity-lock:user:lease-owner'),
    );

    expect(lockKey).toBeDefined();
    expect(await client.zcard(lockKey!)).toBe(2);
    expect(await client.pttl(lockKey!)).toBeGreaterThan(0);

    await releaseFirst();
    expect(await client.zcard(lockKey!)).toBe(1);
    const releaseThird = await limiter.acquireRequest(user, 'lease-ip');
    expect(await client.zcard(lockKey!)).toBe(2);
    await expect(
      limiter.acquireRequest(user, 'lease-ip'),
    ).rejects.toMatchObject({ status: 429 });

    await releaseSecond();
    await releaseThird();
    expect(await client.zcard(lockKey!)).toBe(0);
    await consumeRequest(limiter, user, 'lease-ip');
  });

  it('limits provider concurrency and daily attempts with expiring leases', async () => {
    const dailyNamespace = `ai-assistant:test:${randomUUID()}:`;
    const dailyLimiter = createTestLimiter(
      client,
      {
        globalProviderConcurrency: 4,
        providerDailyAttempts: 200,
      },
      dailyNamespace,
    );
    for (let index = 0; index < 200; index += 1) {
      const release = await dailyLimiter.reserveProviderAttempt();
      await release();
    }
    await expect(dailyLimiter.reserveProviderAttempt()).rejects.toMatchObject({
      status: 429,
      response: {
        code: 'PROVIDER_DAILY_QUOTA',
        retryAfterSeconds: expect.any(Number),
      },
    });

    const dailyKey = [...createdKeys].find(
      (key) =>
        key.startsWith(dailyNamespace) && key.includes(':provider:daily:'),
    );
    expect(dailyKey).toBeDefined();
    expect(await client.get(dailyKey!)).toBe('200');
    expect(await client.ttl(dailyKey!)).toBeGreaterThan(0);
    expect(await client.ttl(dailyKey!)).toBeLessThanOrEqual(86_460);

    const concurrencyNamespace = `ai-assistant:test:${randomUUID()}:`;
    const concurrencyLimiter = createTestLimiter(
      client,
      {
        globalProviderConcurrency: 4,
        providerDailyAttempts: 10,
      },
      concurrencyNamespace,
    );
    const releases = await Promise.all(
      Array.from({ length: 4 }, () =>
        concurrencyLimiter.reserveProviderAttempt(),
      ),
    );
    await expect(
      concurrencyLimiter.reserveProviderAttempt(),
    ).rejects.toMatchObject({
      status: 429,
      response: {
        code: 'PROVIDER_CONCURRENCY',
        retryAfterSeconds: expect.any(Number),
      },
    });

    const activeKey = `${concurrencyNamespace}ai-assistant:provider:in-flight`;
    expect(await client.zcard(activeKey)).toBe(4);
    expect(await client.pttl(activeKey)).toBeGreaterThan(0);
    expect(await client.pttl(activeKey)).toBeLessThanOrEqual(61_000);

    await releases[0]!();
    const releaseFifth = await concurrencyLimiter.reserveProviderAttempt();
    await Promise.all([
      ...releases.slice(1).map((release) => release()),
      releaseFifth(),
    ]);
    expect(await client.zcard(activeKey)).toBe(0);
  }, 15_000);

  it('returns 503 when Redis is unreachable instead of using local state', async () => {
    const unavailableClient = new Redis({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      connectTimeout: 100,
      commandTimeout: 100,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    const limiter = new AiAssistantRateLimit(unavailableClient, baseConfig);

    try {
      await expect(
        limiter.acquireRequest(
          { kind: 'user', id: 'redis-offline' },
          'offline-ip',
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      unavailableClient.disconnect();
    }
  });
});
