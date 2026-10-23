import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  JUDGE_SUBMISSION_JOB,
  JUDGING_JOB_OPTIONS,
  JUDGING_QUEUE,
  type JudgeSubmissionJobData,
} from '../queues/judging-queue.constants.js';
import { JudgingRepository } from './judging.repository.js';

const RECOVERY_BATCH_SIZE = 100;

@Injectable()
export class JudgingRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(JudgingRecoveryService.name);

  constructor(
    private readonly repository: JudgingRepository,
    @InjectQueue(JUDGING_QUEUE)
    private readonly queue: Queue<JudgeSubmissionJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    let afterId: string | null = null;
    let recovered = 0;

    while (true) {
      const submissionIds = await this.repository.findRecoverableIds(afterId, RECOVERY_BATCH_SIZE);
      if (submissionIds.length === 0) break;

      for (const submissionId of submissionIds) {
        const existingJob = await this.queue.getJob(submissionId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'completed' || state === 'failed') await existingJob.remove();
        }

        await this.queue.add(
          JUDGE_SUBMISSION_JOB,
          { submissionId },
          { jobId: submissionId, ...JUDGING_JOB_OPTIONS },
        );
        await this.repository.markQueued(submissionId);
        recovered += 1;
      }

      afterId = submissionIds.at(-1) ?? afterId;
      if (submissionIds.length < RECOVERY_BATCH_SIZE) break;
    }

    if (recovered > 0) this.logger.warn(`Recovered ${recovered} pending judging job(s).`);
  }
}
