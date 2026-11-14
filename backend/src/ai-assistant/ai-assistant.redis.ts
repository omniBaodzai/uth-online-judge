import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { redisProducerClient } from '../queues/redis-clients.js';

export const AI_ASSISTANT_REDIS = Symbol('AI_ASSISTANT_REDIS');

export function createAiAssistantRedisClient(): Redis {
  const client = redisProducerClient.duplicate({
    commandTimeout: 3_500,
    connectTimeout: 3_500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const logger = new Logger('AiAssistantRedis');
  let outageReported = false;
  client.on('error', () => {
    if (outageReported) return;
    outageReported = true;
    logger.warn('AI Assistant Redis connection is unavailable.');
  });
  client.on('ready', () => {
    outageReported = false;
  });
  return client;
}

@Injectable()
export class AiAssistantRedisLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(AI_ASSISTANT_REDIS)
    private readonly client: Redis,
  ) {}

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
