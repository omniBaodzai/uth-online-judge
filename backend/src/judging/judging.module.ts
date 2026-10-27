import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Judge0Module } from '../judge0/judge0.module.js';
import { JUDGING_QUEUE } from '../queues/judging-queue.constants.js';
import { redisProducerClient } from '../queues/redis-clients.js';
import { JudgingProcessor } from './judging.processor.js';
import { JudgingRepository } from './judging.repository.js';
import { JudgingRecoveryService } from './judging-recovery.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: JUDGING_QUEUE,
      connection: redisProducerClient,
    }),
    Judge0Module,
  ],
  providers: [JudgingProcessor, JudgingRepository, JudgingRecoveryService],
  exports: [BullModule],
})
export class JudgingModule {}
