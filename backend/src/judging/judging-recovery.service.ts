import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  JUDGE_SUBMISSION_JOB,
  JUDGING_JOB_OPTIONS,
  JUDGING_QUEUE,
  getJudgingGlobalConcurrency,
  type JudgeSubmissionJobData,
} from '../queues/judging-queue.constants.js';
import { JudgingRepository } from './judging.repository.js';

const RECOVERY_BATCH_SIZE = 100;
const RECOVERY_INTERVAL_MS = 30_000;

@Injectable()
export class JudgingRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JudgingRecoveryService.name);
  private recoveryTimer: NodeJS.Timeout | undefined;
  private recoveryInProgress = false;
  private globalConcurrencyConfigured = false;
  private afterId: string | null = null;

  constructor(
    private readonly repository: JudgingRepository,
    @InjectQueue(JUDGING_QUEUE)
    private readonly queue: Queue<JudgeSubmissionJobData>,
  ) {}

  onModuleInit(): void {
    this.recoveryTimer = setInterval(() => {
      void this.recover();
    }, RECOVERY_INTERVAL_MS);
    this.recoveryTimer.unref();
    void this.recover();
  }

  onModuleDestroy(): void {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  async recover(): Promise<void> {
    if (this.recoveryInProgress) return;
    this.recoveryInProgress = true;
    let recovered = 0;

    try {
      if (!this.globalConcurrencyConfigured) {
        await this.queue.setGlobalConcurrency(getJudgingGlobalConcurrency());
        this.globalConcurrencyConfigured = true;
      }

      const submissions = await this.repository.findRecoverableSubmissions(
        this.afterId,
        RECOVERY_BATCH_SIZE,
      );
      if (submissions.length === 0) {
        this.afterId = null;
        return;
      }

      for (const submission of submissions) {
        const { id: submissionId, status } = submission;
        let requeued = false;
        const existingJob = await this.queue.getJob(submissionId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'completed' || state === 'failed') {
            const recoveryRetry = status === 'RUNNING';
            await existingJob.updateData({
              ...existingJob.data,
              recoveryRetry,
            });
            await existingJob.retry(state, {
              resetAttemptsMade: !recoveryRetry,
              resetAttemptsStarted: !recoveryRetry,
            });
            requeued = true;
          }
        } else {
          await this.queue.add(
            JUDGE_SUBMISSION_JOB,
            {
              submissionId,
              ...(status === 'RUNNING' ? { recoveryRetry: true } : {}),
            },
            { jobId: submissionId, ...JUDGING_JOB_OPTIONS },
          );
          requeued = true;
        }

        await this.repository.markQueued(submissionId);
        if (requeued) recovered += 1;
      }

      this.afterId =
        submissions.length < RECOVERY_BATCH_SIZE
          ? null
          : (submissions.at(-1)?.id ?? this.afterId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Judging recovery cycle failed: ${message}`);
    } finally {
      this.recoveryInProgress = false;
    }

    if (recovered > 0)
      this.logger.warn(`Recovered ${recovered} pending judging job(s).`);
  }
}
