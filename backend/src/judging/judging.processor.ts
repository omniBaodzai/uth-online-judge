import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  JUDGE_SUBMISSION_JOB,
  JUDGING_QUEUE,
  getJudgingBatchSize,
  getJudgingConcurrency,
  type JudgeSubmissionJobData,
} from '../queues/judging-queue.constants.js';
import { redisWorkerClient } from '../queues/redis-clients.js';
import {
  Judge0InfrastructureError,
  Judge0SubmissionTimeoutError,
} from '../judge0/judge0.errors.js';
import { Judge0Service } from '../judge0/judge0.service.js';
import {
  Judge0Verdict,
  MAX_JUDGE0_BATCH_SIZE,
} from '../judge0/judge0.types.js';
import {
  JudgingRepository,
  type JudgingContext,
} from './judging.repository.js';

@Processor(JUDGING_QUEUE, {
  concurrency: getJudgingConcurrency(),
  connection: redisWorkerClient,
})
@Injectable()
export class JudgingProcessor extends WorkerHost {
  private readonly logger = new Logger(JudgingProcessor.name);

  constructor(
    private readonly repository: JudgingRepository,
    private readonly judge0: Judge0Service,
  ) {
    super();
  }

  async process(job: Job<JudgeSubmissionJobData>): Promise<void> {
    if (job.name !== JUDGE_SUBMISSION_JOB || !isUuid(job.data?.submissionId)) {
      throw new Error('Invalid judging job payload.');
    }

    const { submissionId } = job.data;
    const workerStartedAt = performance.now();
    const claimStartedAt = performance.now();
    const claimed = await this.repository.claim(
      submissionId,
      job.attemptsMade > 0 ||
        job.stalledCounter > 0 ||
        job.data.recoveryRetry === true,
    );
    this.logger.log(
      `Judging claim submission=${submissionId} claimed=${claimed} dbMs=${Math.round(performance.now() - claimStartedAt)}`,
    );
    if (!claimed) {
      this.logger.log(
        `Skipped duplicate or terminal judging job ${submissionId}`,
      );
      return;
    }

    try {
      const queueWaitMs = Number.isFinite(job.timestamp)
        ? Math.max(0, Date.now() - job.timestamp)
        : 'unknown';
      this.logger.log(
        `Judging started submission=${submissionId} queueWaitMs=${queueWaitMs} attempt=${job.attemptsMade + 1}`,
      );
      const batchSize = getJudgingBatchSize();
      const initialContext = await this.repository.loadContext(
        submissionId,
        batchSize,
        null,
        job.data.activeBatch?.testCaseIds,
      );
      if (!initialContext || !initialContext.hasSnapshots) {
        await this.repository.persistFinalResult(submissionId, true);
        return;
      }

      let judgingContext = initialContext;
      let pendingTestCases = judgingContext.testCases.filter(
        (testCase) => !testCase.existingResult,
      );
      let activeBatch = job.data.activeBatch;
      let cursorPosition: number | null = null;
      let needsPageLoad = false;
      if (judgingContext.compilationFailed) {
        await updateJobActiveBatch(job);
        await this.repository.persistUnjudgedTestResults(
          submissionId,
          Judge0Verdict.CompilationError,
        );
        pendingTestCases = [];
        activeBatch = undefined;
      }

      let judgedTestCaseCount = 0;
      while (true) {
        if (!activeBatch && pendingTestCases.length === 0) {
          if (!needsPageLoad) break;
          const nextContext = await this.repository.loadContext(
            submissionId,
            batchSize,
            cursorPosition,
          );
          if (!nextContext) {
            throw new Error(
              'Could not reload pending test cases for this submission.',
            );
          }
          judgingContext = nextContext;
          if (judgingContext.compilationFailed) {
            await this.repository.persistUnjudgedTestResults(
              submissionId,
              Judge0Verdict.CompilationError,
            );
            break;
          }
          pendingTestCases = judgingContext.testCases.filter(
            (testCase) => !testCase.existingResult,
          );
          if (pendingTestCases.length === 0) break;
          needsPageLoad = false;
        }

        let batch: JudgingContext['testCases'];
        let tokens: string[];
        if (activeBatch) {
          const resumedBatch = activeBatch;
          if (
            resumedBatch.testCaseIds.length !== resumedBatch.tokens.length ||
            resumedBatch.testCaseIds.length === 0 ||
            resumedBatch.testCaseIds.length > MAX_JUDGE0_BATCH_SIZE ||
            new Set(resumedBatch.testCaseIds).size !==
              resumedBatch.testCaseIds.length ||
            new Set(resumedBatch.tokens).size !== resumedBatch.tokens.length
          ) {
            throw new Error('Invalid active Judge0 batch in judging job data.');
          }
          const activeEntries = resumedBatch.testCaseIds.map((id, index) => ({
            testCase: judgingContext.testCases.find(
              (testCase) => testCase.id === id,
            ),
            token: resumedBatch.tokens[index],
          }));
          if (activeEntries.some(({ testCase }) => !testCase)) {
            throw new Error(
              'Active Judge0 batch references an unknown submission snapshot.',
            );
          }
          const unfinishedEntries = activeEntries.filter(
            (entry) => entry.testCase && !entry.testCase.existingResult,
          );
          const restoredBatch = unfinishedEntries.map(
            ({ testCase }) => testCase,
          );
          batch = restoredBatch.filter(isDefined);
          tokens = unfinishedEntries.map(({ token }) => token);
          if (batch.length === 0) {
            await updateJobActiveBatch(job);
            activeBatch = undefined;
            cursorPosition = Math.max(
              ...activeEntries.map(({ testCase }) => testCase!.position),
            );
            needsPageLoad = true;
            continue;
          }
          await updateJobActiveBatch(job, {
            testCaseIds: batch.map(({ id }) => id),
            tokens,
          });
          this.logger.log(
            `Resuming Judge0 batch submission=${submissionId} count=${batch.length}`,
          );
          activeBatch = undefined;
        } else {
          batch = pendingTestCases.slice(0, batchSize);
          tokens = await this.judge0.createSubmissionBatch(
            batch.map((testCase) => ({
              languageId: judgingContext.judge0LanguageId,
              sourceCode: judgingContext.sourceCode,
              stdin: testCase.input,
              expectedOutput: testCase.expectedOutput,
              cpuTimeLimitSeconds: testCase.cpuTimeLimitSeconds,
              memoryLimitKb: testCase.memoryLimitKb,
            })),
          );
          if (
            tokens.length !== batch.length ||
            new Set(tokens).size !== tokens.length
          ) {
            throw new Error(
              'Judge0 returned invalid token mapping for a judging batch.',
            );
          }
          pendingTestCases = [];
          await updateJobActiveBatch(job, {
            testCaseIds: batch.map((testCase) => testCase.id),
            tokens,
          });
        }
        const activeTestCases = batch.filter(isDefined);
        const tokenToTestCase = new Map(
          tokens.map((token, index) => [token, activeTestCases[index]]),
        );
        const timeoutMs = Math.min(
          12 * 60_000,
          Math.max(
            ...activeTestCases.map(
              (testCase) => testCase.cpuTimeLimitSeconds * 1000,
            ),
          ) + 30_000,
        );
        const outcome = await this.judge0.waitForResults(
          tokens,
          timeoutMs,
          async (results) => {
            const persisted = results
              .filter(
                (result) => result.verdict !== Judge0Verdict.InternalError,
              )
              .map((result) => {
                const testCase = tokenToTestCase.get(result.token);
                if (!testCase) {
                  throw new Error(
                    'Judge0 returned a result outside the active judging batch.',
                  );
                }
                return mapPersistedResult(testCase, result);
              });
            await this.repository.persistTestResults(submissionId, persisted);
            if (
              results.some(
                (result) => result.verdict === Judge0Verdict.InternalError,
              )
            ) {
              await updateJobActiveBatch(job);
              throw new Judge0InfrastructureError(
                'Judge0 reported an internal execution error.',
              );
            }
            const completedIds = new Set(
              persisted.map(({ testCase }) => testCase.id),
            );
            const unfinished = activeTestCases.filter(
              (testCase) => !completedIds.has(testCase.id),
            );
            const unfinishedTokens = tokens.filter((token) => {
              const testCase = tokenToTestCase.get(token);
              return testCase !== undefined && !completedIds.has(testCase.id);
            });
            await updateJobActiveBatch(
              job,
              unfinished.length === 0
                ? undefined
                : {
                    testCaseIds: unfinished.map((testCase) => testCase.id),
                    tokens: unfinishedTokens,
                  },
            );
          },
        );

        if (outcome.timedOut) {
          throw new Judge0SubmissionTimeoutError(
            `Judge0 submission did not finish before the batch deadline (${outcome.results.length}/${batch.length} completed).`,
          );
        }
        await updateJobActiveBatch(job);
        judgedTestCaseCount += activeTestCases.length;
        cursorPosition = Math.max(
          ...activeTestCases.map((testCase) => testCase.position),
        );
        pendingTestCases = [];
        needsPageLoad = true;
        if (
          outcome.results.some(
            (result) => result.verdict === Judge0Verdict.CompilationError,
          )
        ) {
          await this.repository.persistUnjudgedTestResults(
            submissionId,
            Judge0Verdict.CompilationError,
          );
          break;
        }
      }

      await this.repository.persistFinalResult(submissionId);
      this.logger.log(
        `Finished judging submission=${submissionId} testCases=${judgedTestCaseCount} scoring=${judgingContext.scoringEnabled} workerElapsedMs=${Math.round(performance.now() - workerStartedAt)}`,
      );
    } catch (error) {
      const attempts = Number(job.opts.attempts ?? 1);
      if (job.attemptsMade + 1 >= attempts) {
        await this.repository.persistUnjudgedTestResults(submissionId);
        await this.repository.persistFinalResult(submissionId, true);
      }
      const failureType =
        error instanceof Judge0SubmissionTimeoutError
          ? 'Judge0 polling deadline'
          : error instanceof Judge0InfrastructureError
            ? 'Judge0 internal execution error'
            : 'judging attempt failure';
      this.logger.error(
        `${failureType} for submission ${submissionId} (${error instanceof Error ? error.name : 'unknown error'})`,
      );
      throw error;
    } finally {
      await this.repository.releaseClaim(submissionId);
    }
  }

  @OnWorkerEvent('failed')
  async handleFailed(
    job: Job<JudgeSubmissionJobData> | undefined,
  ): Promise<void> {
    if (!job || !isUuid(job.data?.submissionId)) return;
    const attempts = Number(job.opts.attempts ?? 1);
    if (job.attemptsMade < attempts && job.stalledCounter <= 1) return;

    try {
      const claimed = await this.repository.claim(job.data.submissionId, true);
      if (!claimed) return;
      try {
        await this.repository.persistUnjudgedTestResults(job.data.submissionId);
        await this.repository.persistFinalResult(job.data.submissionId, true);
      } finally {
        await this.repository.releaseClaim(job.data.submissionId);
      }
      this.logger.error(
        `Judging exhausted retries for submission ${job.data.submissionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Could not finalize failed submission ${job.data.submissionId} (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
  }
}

async function updateJobActiveBatch(
  job: Job<JudgeSubmissionJobData>,
  activeBatch?: JudgeSubmissionJobData['activeBatch'],
): Promise<void> {
  const nextData: JudgeSubmissionJobData = {
    submissionId: job.data.submissionId,
  };
  if (activeBatch) nextData.activeBatch = activeBatch;
  await job.updateData(nextData);
}

function mapPersistedResult(
  testCase: JudgingContext['testCases'][number],
  result: Awaited<
    ReturnType<Judge0Service['waitForResults']>
  >['results'][number],
) {
  return {
    testCase,
    verdict: result.verdict,
    executionTimeMs:
      result.timeSeconds === null
        ? null
        : Math.max(0, Math.round(result.timeSeconds * 1000)),
    memoryUsedKb: finiteNonNegative(result.memoryKb),
    pointsAwarded: result.verdict === Judge0Verdict.Accepted ? 1 : 0,
  };
}

function finiteNonNegative(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
