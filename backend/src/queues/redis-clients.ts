import { Redis } from 'ioredis';

function configuredAddress(): { host: string; port: number } {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return {
    host: host || '127.0.0.1',
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 6379,
  };
}

export function validateRedisAddress(): void {
  if (!process.env.REDIS_HOST) {
    throw new Error('REDIS_HOST must be configured (use "redis" inside Docker Compose)');
  }
  const port = Number(process.env.REDIS_PORT ?? 6379);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('REDIS_PORT must be a valid port number');
  }
}

const address = configuredAddress();
const retryStrategy = (attempt: number) => Math.min(attempt * 250, 1_000);

export const redisWorkerClient = new Redis({
  ...address,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy,
});

export const redisProducerClient = new Redis({
  ...address,
  lazyConnect: true,
  connectTimeout: 1_000,
  commandTimeout: 3_500,
  maxRetriesPerRequest: 1,
  retryStrategy,
});
