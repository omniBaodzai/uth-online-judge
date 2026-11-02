import { Logger } from '@nestjs/common';
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
export const redisRetryStrategy = (attempt: number) => Math.min(250 * 2 ** (attempt - 1), 5_000);

function logConnectionLifecycle(client: Redis, role: string): void {
  const logger = new Logger('RedisConnection');
  let hasBeenReady = false;
  let outageReported = false;

  client.on('ready', () => {
    if (outageReported) {
      logger.log(`${role} Redis connection restored.`);
    } else if (!hasBeenReady) {
      logger.log(`${role} Redis connection established.`);
    }
    hasBeenReady = true;
    outageReported = false;
  });

  client.on('error', (error: Error) => {
    if (!outageReported) {
      logger.error(`${role} Redis connection error: ${error.message}`);
      outageReported = true;
    }
  });

  client.on('close', () => {
    if (!outageReported) {
      logger.warn(`${role} Redis connection closed; reconnecting.`);
      outageReported = true;
    }
  });

  client.on('reconnecting', (delay: number) => {
    if (outageReported) logger.warn(`${role} Redis reconnect scheduled in ${delay}ms.`);
  });
}

export const redisWorkerClient = new Redis({
  ...address,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: redisRetryStrategy,
});

export const redisProducerClient = new Redis({
  ...address,
  lazyConnect: true,
  commandTimeout: 3_500,
  maxRetriesPerRequest: 1,
  retryStrategy: redisRetryStrategy,
});

logConnectionLifecycle(redisWorkerClient, 'Worker');
logConnectionLifecycle(redisProducerClient, 'Producer');
