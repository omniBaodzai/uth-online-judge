import { BullModule } from '@nestjs/bullmq';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DEMO_QUEUE } from './demo-queue.constants.js';
import { DemoQueueController } from './demo-queue.controller.js';
import { DemoQueueProcessor } from './demo-queue.processor.js';
import { DemoQueueService } from './demo-queue.service.js';

let redisClient: Redis | undefined;

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const host = process.env.REDIS_HOST;
        if (!host) {
          throw new Error('REDIS_HOST must be configured (use "redis" inside Docker Compose)');
        }
        const port = Number(process.env.REDIS_PORT ?? 6379);
        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
          throw new Error('REDIS_PORT must be a valid port number');
        }
        // BullMQ 6 does not bundle ioredis and, under native ESM, needs a ready-made client.
        // maxRetriesPerRequest must be null for workers' blocking commands.
        redisClient = new Redis({ host, port, maxRetriesPerRequest: null });
        return { connection: redisClient };
      },
    }),
    BullModule.registerQueue({ name: DEMO_QUEUE }),
  ],
  controllers: [DemoQueueController],
  providers: [DemoQueueService, DemoQueueProcessor],
})
export class DemoQueueModule implements OnApplicationShutdown {
  // Nest closes queues and workers; the shared client we created is closed here.
  async onApplicationShutdown(): Promise<void> {
    await redisClient?.quit().catch(() => undefined);
  }
}
