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
import { Judge0SubmissionTimeoutError } from '../judge0/judge0.errors.js';
import { Judge0Service } from '../judge0/judge0.service.js';
import { Judge0Verdict } from '../judge0/judge0.types.js';
import { JudgingRepository, type JudgingContext } from './judging.repository.js';

@Processor(JUDGING_QUEUE, { concurrency: getJudgingConcurrency() })
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
      job.attemptsMade > 0 || job.stalledCounter > 0,
    );
    this.logger.log(
      `Judging claim submission=${submissionId} claimed=${claimed} dbMs=${Math.round(performance.now() - claimStartedAt)}`,
    );
    if (!claimed) {
      this.logger.log(`Skipped duplicate or terminal judging job ${submissionId}`);
      return;
    }

    try {
      const queueWaitMs = Number.isFinite(job.timestamp)
        ? Math.max(0, Date.now() - job.timestamp)
        : 'unknown';
      this.logger.log(
        `Judging started submission=${submissionId} queueWaitMs=${queueWaitMs} attempt=${job.attemptsMade + 1}`,
      );
      const context = await this.repository.loadContext(submissionId);
      if (!context || context.testCases.length === 0) {
        await this.repository.persistFinalResult(submissionId, true);
        return;
      }

      const testCasesById = new Map(context.testCases.map((testCase) => [testCase.id, testCase]));
      const pendingTestCases = context.testCases.filter((testCase) => !testCase.existingResult);
      let compilationFailed = context.testCases.some(
        (testCase) => testCase.existingResult?.verdict === Judge0Verdict.CompilationError,
      );
      const batchSize = getJudgingBatchSize();
      let remainingTestCases = pendingTestCases;
      if (compilationFailed) {
        await updateJobActiveBatch(job);
        await this.repository.persistTestResults(
          submissionId,
          remainingTestCases.map((testCase) => compilationErrorResult(testCase)),
        );
        remainingTestCases = [];
      }

      while (remainingTestCases.length > 0) {
        let batch: JudgingContext['testCases'];
        let tokens: string[];
        const activeBatch = job.data.activeBatch;
        if (activeBatch) {
          if (
            activeBatch.testCaseIds.length !== activeBatch.tokens.length
            || activeBatch.testCaseIds.length === 0
            || activeBatch.testCaseIds.length > 4
            || new Set(activeBatch.testCaseIds).size !== activeBatch.testCaseIds.length
            || new Set(activeBatch.tokens).size !== activeBatch.tokens.length
          ) {
            throw new Error('Invalid active Judge0 batch in judging job data.');
          }
          const activeEntries = activeBatch.testCaseIds.map((id, index) => ({
            testCase: testCasesById.get(id),
            token: activeBatch.tokens[index],
          }));
          if (activeEntries.some(({ testCase }) => !testCase)) {
            throw new Error('Active Judge0 batch references an unknown submission snapshot.');
          }
          const unfinishedEntries = activeEntries.filter(
            (entry) => entry.testCase && !entry.testCase.existingResult,
          );
          const restoredBatch = unfinishedEntries.map(({ testCase }) => testCase);
          if (
            restoredBatch.some((testCase) => !testCase || testCase.existingResult)
            || restoredBatch.some((testCase, index) => testCase !== remainingTestCases[index])
          ) {
            throw new Error('Active Judge0 batch does not match pending submission snapshots.');
          }
          batch = restoredBatch.filter(isDefined);
          tokens = unfinishedEntries.map(({ token }) => token);
          if (batch.length === 0) {
            await updateJobActiveBatch(job);
            continue;
          }
          await updateJobActiveBatch(job, { testCaseIds: batch.map(({ id }) => id), tokens });
          this.logger.log(`Resuming Judge0 batch submission=${submissionId} count=${batch.length}`);
        } else {
          batch = remainingTestCases.slice(0, batchSize);
          tokens = await this.judge0.createSubmissionBatch(
            batch.map((testCase) => ({
              languageId: context.judge0LanguageId,
              sourceCode: context.sourceCode,
              stdin: testCase.input,
              expectedOutput: testCase.expectedOutput,
              cpuTimeLimitSeconds: testCase.cpuTimeLimitSeconds,
              memoryLimitKb: testCase.memoryLimitKb,
            })),
          );
          if (tokens.length !== batch.length || new Set(tokens).size !== tokens.length) {
            throw new Error('Judge0 returned invalid token mapping for a judging batch.');
          }
          await updateJobActiveBatch(job, {
            testCaseIds: batch.map((testCase) => testCase.id),
            tokens,
          });
        }
        const activeTestCases = batch.filter(isDefined);
        const tokenToTestCase = new Map(tokens.map((token, index) => [token, activeTestCases[index]]));
        const timeoutMs = Math.min(
          12 * 60_000,
          Math.max(...activeTestCases.map((testCase) => testCase.cpuTimeLimitSeconds * 1000)) + 30_000,
        );
        const outcome = await this.judge0.waitForResults(tokens, timeoutMs, async (results) => {
          const persisted = results.map((result) => {
            const testCase = tokenToTestCase.get(result.token);
            if (!testCase || testCasesById.get(testCase.id) !== testCase) {
              throw new Error('Judge0 returned a result outside the active judging batch.');
            }
            if (result.verdict === Judge0Verdict.CompilationError) compilationFailed = true;
            return mapPersistedResult(testCase, result, context.scoringEnabled);
          });
          await this.repository.persistTestResults(submissionId, persisted);
          const completedIds = new Set(persisted.map(({ testCase }) => testCase.id));
          const unfinished = activeTestCases.filter((testCase) => !completedIds.has(testCase.id));
          const unfinishedTokens = tokens.filter((token) => {
            const testCase = tokenToTestCase.get(token);
            return testCase !== undefined && !completedIds.has(testCase.id);
          });
          await updateJobActiveBatch(job, unfinished.length === 0 ? undefined : {
            testCaseIds: unfinished.map((testCase) => testCase.id),
            tokens: unfinishedTokens,
          });
        });

        if (outcome.timedOut) {
          await updateJobActiveBatch(job);
          await this.repository.persistUnjudgedTestResults(submissionId);
          await this.repository.persistFinalResult(submissionId, true);
          this.logger.error(
            `Judge0 batch deadline reached submission=${submissionId} completed=${outcome.results.length}/${batch.length}`,
          );
          return;
        }
        await updateJobActiveBatch(job);
        remainingTestCases = remainingTestCases.slice(activeTestCases.length);
        if (outcome.results.some((result) => result.verdict === Judge0Verdict.CompilationError)) {
          compilationFailed = true;
          await this.repository.persistTestResults(
            submissionId,
            remainingTestCases.map((testCase) => compilationErrorResult(testCase)),
          );
          remainingTestCases = [];
        }
      }

      await this.repository.persistFinalResult(submissionId);
      this.logger.log(
        `Finished judging submission=${submissionId} testCases=${context.testCases.length} scoring=${context.scoringEnabled} workerElapsedMs=${Math.round(performance.now() - workerStartedAt)}`,
      );
    } catch (error) {
      if (error instanceof Judge0SubmissionTimeoutError) {
        await this.repository.persistUnjudgedTestResults(submissionId);
        await this.repository.persistFinalResult(submissionId, true);
        this.logger.error(
          `Judge0 did not finish submission ${submissionId} before its polling deadline; finalized without retry`,
        );
        return;
      }

      const attempts = Number(job.opts.attempts ?? 1);
      if (job.attemptsMade + 1 >= attempts) {
        await this.repository.persistFinalResult(submissionId, true);
      }
      this.logger.error(
        `Judging attempt failed for submission ${submissionId} (${error instanceof Error ? error.name : 'unknown error'})`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async handleFailed(job: Job<JudgeSubmissionJobData> | undefined): Promise<void> {
    if (!job || !isUuid(job.data?.submissionId)) return;
    const attempts = Number(job.opts.attempts ?? 1);
    if (job.attemptsMade < attempts && job.stalledCounter <= 1) return;

    try {
      await this.repository.persistFinalResult(job.data.submissionId, true);
      this.logger.error(`Judging exhausted retries for submission ${job.data.submissionId}`);
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
  const nextData: JudgeSubmissionJobData = { submissionId: job.data.submissionId };
  if (activeBatch) nextData.activeBatch = activeBatch;
  await job.updateData(nextData);
}

function compilationErrorResult(testCase: JudgingContext['testCases'][number]) {
  return {
    testCase,
    verdict: Judge0Verdict.CompilationError,
    executionTimeMs: null,
    memoryUsedKb: null,
    pointsAwarded: 0,
  };
}

function mapPersistedResult(
  testCase: JudgingContext['testCases'][number],
  result: Awaited<ReturnType<Judge0Service['waitForResults']>>['results'][number],
  scoringEnabled: boolean,
) {
  return {
    testCase,
    verdict: result.verdict,
    executionTimeMs: result.timeSeconds === null ? null : Math.max(0, Math.round(result.timeSeconds * 1000)),
    memoryUsedKb: finiteNonNegative(result.memoryKb),
    pointsAwarded: scoringEnabled && result.verdict === Judge0Verdict.Accepted
      ? testCase.points
      : 0,
  };
}

function finiteNonNegative(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
