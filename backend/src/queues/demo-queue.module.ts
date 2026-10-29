import { BullModule } from '@nestjs/bullmq';
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { DEMO_QUEUE } from './demo-queue.constants.js';
import { DemoQueueController } from './demo-queue.controller.js';
import { DemoQueueProcessor } from './demo-queue.processor.js';
import { DemoQueueService } from './demo-queue.service.js';
import {
  redisProducerClient,
  redisWorkerClient,
  validateRedisAddress,
} from './redis-clients.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        validateRedisAddress();
        return { connection: redisWorkerClient };
      },
    }),
    BullModule.registerQueue({
      name: DEMO_QUEUE,
      connection: redisProducerClient,
    }),
  ],
  controllers: [DemoQueueController],
  providers: [DemoQueueService, DemoQueueProcessor],
})
export class DemoQueueModule implements OnApplicationShutdown {
  // Nest closes queues and workers; this module owns and disconnects both clients.
  async onApplicationShutdown(): Promise<void> {
    redisProducerClient.disconnect();
    redisWorkerClient.disconnect();
  }
}
