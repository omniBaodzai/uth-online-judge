import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DEMO_QUEUE,
  UPPERCASE_TEXT_JOB,
  type DemoJobState,
  type UppercaseTextJobData,
  type UppercaseTextJobResult,
} from './demo-queue.constants.js';

export interface DemoJobStatus {
  jobId: string;
  state: DemoJobState;
  result?: UppercaseTextJobResult;
  failedReason?: string;
}

const KNOWN_STATES: readonly DemoJobState[] = ['completed', 'failed', 'active', 'waiting', 'delayed'];

@Injectable()
export class DemoQueueService {
  private readonly logger = new Logger(DemoQueueService.name);

  constructor(
    @InjectQueue(DEMO_QUEUE)
    private readonly queue: Queue<UppercaseTextJobData, UppercaseTextJobResult>,
  ) {}

  async enqueueUppercase(text: string): Promise<{ jobId: string }> {
    // A random id keeps every request a distinct job; BullMQ rejects numeric-like custom ids.
    const jobId = randomUUID();
    try {
      await this.queue.add(
        UPPERCASE_TEXT_JOB,
        { text },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          // Bounded retention so finished demo jobs do not accumulate in Redis forever.
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 86400, count: 100 },
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue ${UPPERCASE_TEXT_JOB}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException('The job queue is currently unavailable.');
    }
    this.logger.log(`Enqueued ${UPPERCASE_TEXT_JOB} job ${jobId}`);
    return { jobId };
  }

  async getStatus(jobId: string): Promise<DemoJobStatus> {
    let job;
    let state: string;
    try {
      job = await this.queue.getJob(jobId);
      state = job ? await job.getState() : 'unknown';
    } catch (error) {
      this.logger.error(
        `Failed to read job ${jobId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException('The job queue is currently unavailable.');
    }
    if (!job) {
      throw new NotFoundException('Job not found or already expired.');
    }

    const known = KNOWN_STATES.find((value) => value === state) ?? 'unknown';
    return {
      jobId,
      state: known,
      ...(known === 'completed' && job.returnvalue ? { result: job.returnvalue } : {}),
      // Internal failure text is logged by the worker, not returned to clients.
      ...(known === 'failed' ? { failedReason: 'Job processing failed.' } : {}),
    };
  }
}
