export const JUDGING_QUEUE = 'judging';
export const JUDGE_SUBMISSION_JOB = 'judge-submission';

export interface JudgeSubmissionJobData {
  submissionId: string;
  activeBatch?: {
    testCaseIds: string[];
    tokens: string[];
  };
}

export const JUDGING_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 10_000 },
};

export function getJudgingConcurrency(value = process.env.JUDGING_CONCURRENCY): number {
  const parsed = Number(value ?? 2);
  if (!Number.isInteger(parsed) || parsed < 1) return 2;
  return Math.min(parsed, 8);
}

export function getJudgingBatchSize(value = process.env.JUDGING_BATCH_SIZE): number {
  const parsed = Number(value ?? 3);
  if (!Number.isInteger(parsed) || parsed < 1) return 3;
  return Math.min(parsed, 4);
}
