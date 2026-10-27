import { redisProducerClient, redisWorkerClient } from './redis-clients.js';

describe('BullMQ Redis client roles', () => {
  it('keeps worker retries unbounded while bounding producer command retries and duration', () => {
    expect(redisWorkerClient.options.maxRetriesPerRequest).toBeNull();
    expect(redisProducerClient.options.maxRetriesPerRequest).toBe(1);
    expect(redisProducerClient.options.connectTimeout).toBe(1_000);
    expect(redisProducerClient.options.commandTimeout).toBe(3_500);
    expect(redisProducerClient).not.toBe(redisWorkerClient);
  });
});
