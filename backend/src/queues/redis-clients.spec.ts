import {
  redisProducerClient,
  redisRetryStrategy,
  redisWorkerClient,
} from './redis-clients.js';

describe('BullMQ Redis client roles', () => {
  it('keeps worker retries unbounded while bounding producer command retries and duration', () => {
    expect(redisWorkerClient.options.maxRetriesPerRequest).toBeNull();
    expect(redisProducerClient.options.maxRetriesPerRequest).toBe(1);
    expect(redisProducerClient.options.connectTimeout).toBe(10_000);
    expect(redisProducerClient.options.commandTimeout).toBe(3_500);
    expect(redisProducerClient).not.toBe(redisWorkerClient);
  });

  it('backs off reconnect attempts exponentially and caps the delay at five seconds', () => {
    expect([1, 2, 3, 4, 5, 6, 100].map(redisRetryStrategy))
      .toEqual([250, 500, 1_000, 2_000, 4_000, 5_000, 5_000]);
  });
});
