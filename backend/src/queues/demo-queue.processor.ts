import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  DEMO_QUEUE,
  UPPERCASE_TEXT_JOB,
  type UppercaseTextJobData,
  type UppercaseTextJobResult,
} from './demo-queue.constants.js';
import { redisWorkerClient } from './redis-clients.js';

@Processor(DEMO_QUEUE, { connection: redisWorkerClient })
export class DemoQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(DemoQueueProcessor.name);

  async process(
    job: Job<UppercaseTextJobData, UppercaseTextJobResult>,
  ): Promise<UppercaseTextJobResult> {
    if (job.name !== UPPERCASE_TEXT_JOB) {
      throw new Error(`Unsupported job name: ${job.name}`);
    }
    if (typeof job.data?.text !== 'string') {
      throw new Error('Invalid job payload');
    }

    const result = { text: job.data.text.toUpperCase() };
    // Only ids are logged; payload text is user-provided and not needed for operations.
    this.logger.log(`Processed ${job.name} job ${job.id}`);
    return result;
  }
}
