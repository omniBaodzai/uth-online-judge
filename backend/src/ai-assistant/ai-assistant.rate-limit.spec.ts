import { ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { loadAiAssistantConfig } from './ai-assistant.config.js';
import { AiAssistantRateLimit } from './ai-assistant.rate-limit.js';

const config = loadAiAssistantConfig({});

function createLimiter(evalScript: ReturnType<typeof vi.fn>) {
  return new AiAssistantRateLimit(
    { eval: evalScript } as unknown as Redis,
    config,
  );
}

describe('AiAssistantRateLimit', () => {
  it('reserves global, IP, identity and guest-hour buckets atomically', async () => {
    const evaluate = vi.fn().mockResolvedValue([0, 0]);
    const limiter = createLimiter(evaluate);
    const release = await limiter.acquireRequest(
      { kind: 'guest', id: 'opaque-guest-key' },
      'hmac-ip-key',
    );

    expect(evaluate).toHaveBeenCalledOnce();
    const [script, keyCount, ...args] = evaluate.mock.calls[0] as [
      string,
      number,
      ...string[],
    ];
    const keys = args.slice(0, keyCount);
    expect(script).toContain("redis.call('INCR'");
    expect(script).toContain("redis.call('ZREMRANGEBYSCORE', lockKey");
    expect(keys).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ai-assistant:http:global:/),
        expect.stringMatching(/^ai-assistant:http:ip:hmac-ip-key:/),
        expect.stringMatching(
          /^ai-assistant:http:guest:opaque-guest-key:minute:/,
        ),
        expect.stringMatching(
          /^ai-assistant:http:guest:opaque-guest-key:hour:/,
        ),
        'ai-assistant:identity-lock:guest:opaque-guest-key',
      ]),
    );
    expect(args.slice(keyCount)).toEqual([
      '300',
      '300',
      '10',
      '1',
      '60',
      '60000',
      expect.any(String),
      expect.any(String),
      '1',
    ]);

    await release();
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate.mock.calls[1]?.[0]).toContain("redis.call('ZREM'");
  });

  it('uses the authenticated user bucket and omits the guest hourly bucket', async () => {
    const evaluate = vi.fn().mockResolvedValue([0, 0]);
    const limiter = createLimiter(evaluate);
    await limiter.acquireRequest(
      { kind: 'user', id: 'user-id' },
      'hmac-ip-key',
    );

    const [, keyCount, ...args] = evaluate.mock.calls[0] as [
      string,
      number,
      ...string[],
    ];
    const keys = args.slice(0, keyCount);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('ai-assistant:identity-lock:user:user-id');
    expect(keys.some((key) => key.includes(':hour:'))).toBe(false);
    expect(args.slice(keyCount, keyCount + 5)).toEqual([
      '300',
      '300',
      '20',
      '0',
      '60',
    ]);
  });

  it.each([
    [1, 'GLOBAL_RATE_LIMIT'],
    [2, 'IP_RATE_LIMIT'],
    [3, 'RATE_LIMIT_MINUTE'],
    [4, 'RATE_LIMIT_HOUR'],
    [5, 'CONCURRENT_REQUEST'],
  ] as const)(
    'reports %s when the atomic request limiter returns status %i',
    async (status, errorCode) => {
      const limiter = createLimiter(vi.fn().mockResolvedValue([status, 37]));
      await expect(
        limiter.acquireRequest({ kind: 'guest', id: 'guest-key' }, 'ip-hash'),
      ).rejects.toMatchObject({
        status: 429,
        response: {
          code: errorCode,
          retryAfterSeconds: 37,
        },
      });
    },
  );

  it('reserves daily provider usage and global concurrency in one atomic operation', async () => {
    const evaluate = vi.fn().mockResolvedValue([0, 0]);
    const limiter = createLimiter(evaluate);
    const release = await limiter.reserveProviderAttempt();

    expect(evaluate).toHaveBeenCalledOnce();
    const [script, keyCount, ...args] = evaluate.mock.calls[0] as [
      string,
      number,
      ...string[],
    ];
    const keys = args.slice(0, keyCount);
    expect(script).toContain("redis.call('ZREMRANGEBYSCORE'");
    expect(script).toContain("redis.call('INCR', KEYS[2])");
    expect(keys).toEqual([
      'ai-assistant:provider:in-flight',
      expect.stringMatching(/^ai-assistant:provider:daily:\d{4}-\d{2}-\d{2}$/),
    ]);
    expect(args.slice(keyCount, keyCount + 3)).toEqual([
      expect.any(String),
      '4',
      '200',
    ]);
    expect(args[keyCount + 6]).toEqual(expect.any(String));

    await release();
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate.mock.calls[1]?.[0]).toContain("redis.call('ZREM'");
  });

  it.each([
    [1, 'PROVIDER_CONCURRENCY'],
    [2, 'PROVIDER_DAILY_QUOTA'],
  ] as const)(
    'reports %s when provider reservation status is %i',
    async (status, errorCode) => {
      const limiter = createLimiter(vi.fn().mockResolvedValue([status, 37]));
      await expect(limiter.reserveProviderAttempt()).rejects.toMatchObject({
        status: 429,
        response: {
          code: errorCode,
          retryAfterSeconds: 37,
        },
      });
    },
  );

  it('fails closed when Redis commands fail', async () => {
    const limiter = createLimiter(
      vi.fn().mockRejectedValue(new Error('private Redis connection detail')),
    );

    await expect(
      limiter.acquireRequest({ kind: 'user', id: 'user-id' }, 'ip-hash'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(limiter.reserveProviderAttempt()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
