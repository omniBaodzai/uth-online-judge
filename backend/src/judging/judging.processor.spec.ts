import { Judge0Service } from '../judge0/judge0.service.js';
import { Judge0Verdict, type Judge0SubmissionResult } from '../judge0/judge0.types.js';
import { JUDGE_SUBMISSION_JOB, type JudgeSubmissionJobData } from '../queues/judging-queue.constants.js';
import { JudgingProcessor } from './judging.processor.js';
import { JudgingRepository, type JudgingContext } from './judging.repository.js';

const testCases: JudgingContext['testCases'] = [
  {
    id: 'case-1', snapshotId: 'snapshot-1', name: 'sample', position: 1,
    input: 'private input 1', expectedOutput: 'private output 1', points: 2,
    cpuTimeLimitSeconds: 1.5, memoryLimitKb: 262144,
  },
  {
    id: 'case-2', snapshotId: 'snapshot-2', name: 'hidden', position: 2,
    input: 'private input 2', expectedOutput: 'private output 2', points: 3,
    cpuTimeLimitSeconds: 1.5, memoryLimitKb: 262144,
  },
];

const context: JudgingContext = {
  sourceCode: 'private source',
  judge0LanguageId: 54,
  scoringEnabled: true,
  maxScore: 5,
  testCases,
};

function job(attemptsMade = 0) {
  const data: JudgeSubmissionJobData = { submissionId: 'a246b1f2-c8bb-4b43-b2e1-b50dc6001e11' };
  return {
    id: 'submission-1',
    name: JUDGE_SUBMISSION_JOB,
    data,
    opts: { attempts: 3 },
    attemptsMade,
    stalledCounter: 0,
    timestamp: Date.now(),
    updateData: vi.fn(async (nextData: JudgeSubmissionJobData) => {
      Object.assign(data, nextData);
      if (!nextData.activeBatch) delete data.activeBatch;
    }),
  } as never;
}

function result(token: string, verdict = Judge0Verdict.Accepted, timeSeconds: number | null = 0.006) {
  return {
    token,
    verdict,
    isFinished: true,
    statusId: verdict === Judge0Verdict.Accepted ? 3 : 6,
    statusDescription: verdict,
    stdout: null,
    stderr: null,
    compileOutput: null,
    message: null,
    timeSeconds,
    wallTimeSeconds: null,
    memoryKb: 1925,
    submissionDurationMs: null,
  } satisfies Judge0SubmissionResult;
}

describe('JudgingProcessor', () => {
  const repository = {
    claim: vi.fn(),
    loadContext: vi.fn(),
    persistTestResult: vi.fn(),
    persistTestResults: vi.fn(),
    persistUnjudgedTestResults: vi.fn(),
    persistFinalResult: vi.fn(),
  };
  const judge0 = {
    createSubmissionBatch: vi.fn(),
    waitForResults: vi.fn(),
  };
  const processor = new JudgingProcessor(
    repository as unknown as JudgingRepository,
    judge0 as unknown as Judge0Service,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    repository.claim.mockResolvedValue(true);
    repository.loadContext.mockResolvedValue(context);
    repository.persistTestResults.mockResolvedValue(undefined);
    repository.persistUnjudgedTestResults.mockResolvedValue(undefined);
    repository.persistFinalResult.mockResolvedValue(undefined);
    judge0.createSubmissionBatch.mockImplementation(async (inputs: unknown[]) =>
      inputs.map((_input, index) => `judge-token-${index + 1}`));
    judge0.waitForResults.mockImplementation(async (
      tokens: string[],
      _timeoutMs: number,
      onCompleted?: (completed: Judge0SubmissionResult[]) => Promise<void>,
    ) => {
      const results = tokens.map((token) => result(token));
      if (onCompleted) await onCompleted(results);
      return { results, timedOut: false };
    });
  });

  it('submits a bounded batch with snapshots, limits, and awards accepted points', async () => {
    await processor.process(job());

    expect(judge0.createSubmissionBatch).toHaveBeenCalledOnce();
    expect(judge0.createSubmissionBatch).toHaveBeenCalledWith([
      {
        languageId: 54, sourceCode: context.sourceCode, stdin: testCases[0].input,
        expectedOutput: testCases[0].expectedOutput, cpuTimeLimitSeconds: 1.5, memoryLimitKb: 262144,
      },
      {
        languageId: 54, sourceCode: context.sourceCode, stdin: testCases[1].input,
        expectedOutput: testCases[1].expectedOutput, cpuTimeLimitSeconds: 1.5, memoryLimitKb: 262144,
      },
    ]);
    expect(judge0.waitForResults).toHaveBeenCalledWith(
      ['judge-token-1', 'judge-token-2'],
      31_500,
      expect.any(Function),
    );
    expect(repository.persistTestResults).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ testCase: testCases[0], verdict: Judge0Verdict.Accepted, pointsAwarded: 2 }),
        expect.objectContaining({ testCase: testCases[1], verdict: Judge0Verdict.Accepted, pointsAwarded: 3 }),
      ]),
    );
    expect(repository.persistFinalResult).toHaveBeenCalledWith(expect.any(String));
  });

  it('keeps verdict judging active but awards no points when scoring is disabled', async () => {
    repository.loadContext.mockResolvedValue({ ...context, scoringEnabled: false });

    await processor.process(job());

    expect(repository.persistTestResults.mock.calls[0][1].map((item: { pointsAwarded: number }) => item.pointsAwarded))
      .toEqual([0, 0]);
    expect(repository.persistTestResults.mock.calls[0][1].map((item: { verdict: Judge0Verdict }) => item.verdict))
      .toEqual([Judge0Verdict.Accepted, Judge0Verdict.Accepted]);
  });

  it.each([
    Judge0Verdict.WrongAnswer,
    Judge0Verdict.TimeLimitExceeded,
    Judge0Verdict.RuntimeError,
    Judge0Verdict.InternalError,
  ])('persists %s without points while judging other tests', async (verdict) => {
    judge0.waitForResults.mockImplementationOnce(async (
      tokens: string[],
      _timeout: number,
      onCompleted?: (completed: Judge0SubmissionResult[]) => Promise<void>,
    ) => {
      const results = [result(tokens[0], verdict, null), result(tokens[1])];
      if (onCompleted) await onCompleted(results);
      return { results, timedOut: false };
    });

    await processor.process(job());

    expect(repository.persistTestResults.mock.calls[0][1]).toMatchObject([
      { verdict, pointsAwarded: 0 },
      { verdict: Judge0Verdict.Accepted, pointsAwarded: 3 },
    ]);
  });

  it('preserves completed results on transient retry and only schedules missing snapshots', async () => {
    judge0.createSubmissionBatch.mockRejectedValueOnce(new Error('upstream unavailable'));
    await expect(processor.process(job(0))).rejects.toThrow('upstream unavailable');
    expect(repository.persistFinalResult).not.toHaveBeenCalled();

    const alreadyJudged = {
      ...testCases[0],
      existingResult: {
        verdict: Judge0Verdict.Accepted,
        executionTimeMs: 6,
        memoryUsedKb: 1925,
        pointsAwarded: 2,
      },
    };
    repository.loadContext.mockResolvedValue({ ...context, testCases: [alreadyJudged, testCases[1]] });
    judge0.createSubmissionBatch.mockResolvedValue(['retry-token']);
    judge0.waitForResults.mockImplementationOnce(async (tokens: string[], _timeout: number, onCompleted?: (items: Judge0SubmissionResult[]) => Promise<void>) => {
      const results = [result(tokens[0])];
      if (onCompleted) await onCompleted(results);
      return { results, timedOut: false };
    });
    await processor.process(job(1));

    expect(repository.claim).toHaveBeenNthCalledWith(1, expect.any(String), false);
    expect(repository.claim).toHaveBeenNthCalledWith(2, expect.any(String), true);
    expect(judge0.createSubmissionBatch).toHaveBeenLastCalledWith([
      expect.objectContaining({ stdin: testCases[1].input }),
    ]);
    expect(repository.persistFinalResult).toHaveBeenCalledOnce();
  });

  it('reuses persisted Judge0 tokens after a transient polling failure', async () => {
    const firstAttempt = job();
    judge0.waitForResults.mockRejectedValueOnce(new Error('temporary poll failure'));
    await expect(processor.process(firstAttempt)).rejects.toThrow('temporary poll failure');
    const activeBatch = (firstAttempt as { data: JudgeSubmissionJobData }).data.activeBatch;
    expect(activeBatch).toEqual({
      testCaseIds: ['case-1', 'case-2'],
      tokens: ['judge-token-1', 'judge-token-2'],
    });

    const retry = job(1);
    (retry as { data: JudgeSubmissionJobData }).data.activeBatch = activeBatch;
    await processor.process(retry);

    expect(judge0.createSubmissionBatch).toHaveBeenCalledOnce();
    expect(judge0.waitForResults).toHaveBeenLastCalledWith(
      ['judge-token-1', 'judge-token-2'],
      31_500,
      expect.any(Function),
    );
  });

  it('resumes only unfinished tokens when a poll fails after persisting part of a batch', async () => {
    const firstAttempt = job();
    judge0.waitForResults.mockImplementationOnce(async (
      tokens: string[],
      _timeout: number,
      onCompleted?: (completed: Judge0SubmissionResult[]) => Promise<void>,
    ) => {
      if (onCompleted) await onCompleted([result(tokens[0])]);
      throw new Error('poll connection dropped');
    });
    await expect(processor.process(firstAttempt)).rejects.toThrow('poll connection dropped');
    const savedData = (firstAttempt as { data: JudgeSubmissionJobData }).data;
    expect(savedData.activeBatch).toEqual({ testCaseIds: ['case-2'], tokens: ['judge-token-2'] });

    const alreadyJudged = {
      ...testCases[0],
      existingResult: {
        verdict: Judge0Verdict.Accepted,
        executionTimeMs: 6,
        memoryUsedKb: 1925,
        pointsAwarded: 2,
      },
    };
    repository.loadContext.mockResolvedValue({ ...context, testCases: [alreadyJudged, testCases[1]] });
    const retry = job(1);
    (retry as { data: JudgeSubmissionJobData }).data.activeBatch = savedData.activeBatch;
    await processor.process(retry);

    expect(judge0.createSubmissionBatch).toHaveBeenCalledOnce();
    expect(judge0.waitForResults).toHaveBeenLastCalledWith(
      ['judge-token-2'],
      31_500,
      expect.any(Function),
    );
  });

  it('marks remaining batches CE when a compilation error occurs', async () => {
    const extendedCases = [
      ...testCases,
      { ...testCases[0], id: 'case-3', snapshotId: 'snapshot-3', position: 3 },
      { ...testCases[0], id: 'case-4', snapshotId: 'snapshot-4', position: 4 },
    ];
    repository.loadContext.mockResolvedValue({ ...context, testCases: extendedCases });
    judge0.waitForResults.mockImplementationOnce(async (tokens: string[], _timeout: number, onCompleted?: (items: Judge0SubmissionResult[]) => Promise<void>) => {
      const results = tokens.map((token, index) => result(
        token,
        index === 0 ? Judge0Verdict.CompilationError : Judge0Verdict.Accepted,
        index === 0 ? null : 0.006,
      ));
      if (onCompleted) await onCompleted(results);
      return { results, timedOut: false };
    });

    await processor.process(job());

    expect(judge0.createSubmissionBatch).toHaveBeenCalledOnce();
    expect(repository.persistTestResults).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({ testCase: extendedCases[3], verdict: Judge0Verdict.CompilationError }),
    ]);
  });

  it('finalizes a batch polling deadline without overwriting completed results', async () => {
    judge0.waitForResults.mockResolvedValue({ results: [result('judge-token-1')], timedOut: true });

    await expect(processor.process(job())).resolves.toBeUndefined();

    expect(repository.persistUnjudgedTestResults).toHaveBeenCalledWith(
      'a246b1f2-c8bb-4b43-b2e1-b50dc6001e11',
    );
    expect(repository.persistFinalResult).toHaveBeenCalledWith(
      'a246b1f2-c8bb-4b43-b2e1-b50dc6001e11',
      true,
    );
  });

  it('marks the submission failed after exhausted transient attempts', async () => {
    judge0.waitForResults.mockRejectedValue(new Error('poll request failed'));

    await expect(processor.process(job(2))).rejects.toThrow('poll request failed');
    expect(repository.persistFinalResult).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('skips duplicate jobs and keeps source code and test data out of queue payloads', async () => {
    repository.claim.mockResolvedValue(false);
    await processor.process(job());
    expect(repository.loadContext).not.toHaveBeenCalled();
    expect(judge0.createSubmissionBatch).not.toHaveBeenCalled();

    const payload = job().data;
    expect(payload).toEqual({ submissionId: 'a246b1f2-c8bb-4b43-b2e1-b50dc6001e11' });
    expect(JSON.stringify(payload)).not.toContain(context.sourceCode);
    expect(JSON.stringify(payload)).not.toContain(testCases[0].input);
    expect(JSON.stringify(payload)).not.toContain(testCases[0].expectedOutput);
  });
});
