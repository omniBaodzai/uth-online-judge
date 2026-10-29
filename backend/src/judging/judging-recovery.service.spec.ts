import {
  JUDGE_SUBMISSION_JOB,
  JUDGING_JOB_OPTIONS,
} from '../queues/judging-queue.constants.js';
import { JudgingRecoveryService } from './judging-recovery.service.js';
import { JudgingRepository } from './judging.repository.js';

describe('JudgingRecoveryService', () => {
  it('re-enqueues recoverable submissions with idempotent job ids', async () => {
    const repository = {
      findRecoverableSubmissions: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'submission-1', status: 'PENDING' }])
        .mockResolvedValueOnce([]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      setGlobalConcurrency: vi.fn().mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.recover();

    expect(repository.findRecoverableSubmissions).toHaveBeenNthCalledWith(1, null, 100);
    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(2);
    expect(queue.add).toHaveBeenCalledWith(
      JUDGE_SUBMISSION_JOB,
      { submissionId: 'submission-1' },
      { jobId: 'submission-1', ...JUDGING_JOB_OPTIONS },
    );
    expect(repository.markQueued).toHaveBeenCalledWith('submission-1');
  });

  it('retries a retained failed job in place with reset attempts', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findRecoverableSubmissions: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'submission-1', status: 'PENDING' }])
        .mockResolvedValueOnce([]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      setGlobalConcurrency: vi.fn().mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue({
        getState: vi.fn().mockResolvedValue('failed'),
        updateData: vi.fn().mockResolvedValue(undefined),
        retry,
      }),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.recover();
    expect(retry).toHaveBeenCalledWith('failed', {
      resetAttemptsMade: true,
      resetAttemptsStarted: true,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not remove or recreate an active job during recovery', async () => {
    const retry = vi.fn();
    const add = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findRecoverableSubmissions: vi
        .fn()
        .mockResolvedValue([{ id: 'submission-1', status: 'PENDING' }]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      setGlobalConcurrency: vi.fn().mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue({
        getState: vi.fn().mockResolvedValue('active'),
        retry,
      }),
      add,
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.recover();

    expect(retry).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(repository.markQueued).toHaveBeenCalledWith('submission-1');
  });

  it('recovers RUNNING submissions only through a marked retry claim', async () => {
    const updateData = vi.fn().mockResolvedValue(undefined);
    const retry = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findRecoverableSubmissions: vi
        .fn()
        .mockResolvedValue([{ id: 'submission-1', status: 'RUNNING' }]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      setGlobalConcurrency: vi.fn().mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue({
        data: { submissionId: 'submission-1' },
        getState: vi.fn().mockResolvedValue('failed'),
        updateData,
        retry,
      }),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.recover();

    expect(updateData).toHaveBeenCalledWith({
      submissionId: 'submission-1',
      recoveryRetry: true,
    });
    expect(retry).toHaveBeenCalledWith('failed', {
      resetAttemptsMade: false,
      resetAttemptsStarted: false,
    });
    expect(repository.markQueued).toHaveBeenCalledWith('submission-1');
  });

  it('does not block module startup while Redis is connecting', async () => {
    let releaseConcurrency: (() => void) | undefined;
    const queue = {
      setGlobalConcurrency: vi.fn().mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseConcurrency = resolve;
          }),
      ).mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const repository = {
      findRecoverableSubmissions: vi
        .fn()
        .mockResolvedValue([{ id: 'submission-1', status: 'PENDING' }]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    expect(() => service.onModuleInit()).not.toThrow();
    await vi.waitFor(() =>
      expect(queue.setGlobalConcurrency).toHaveBeenCalledOnce(),
    );
    releaseConcurrency?.();
    await vi.waitFor(() =>
      expect(repository.findRecoverableSubmissions).toHaveBeenCalledOnce(),
    );
    expect(queue.add).toHaveBeenCalledWith(
      JUDGE_SUBMISSION_JOB,
      { submissionId: 'submission-1' },
      { jobId: 'submission-1', ...JUDGING_JOB_OPTIONS },
    );
    service.onModuleDestroy();
  });

  it('retries a Redis recovery failure without requiring a backend restart', async () => {
    const queue = {
      setGlobalConcurrency: vi
        .fn()
        .mockRejectedValueOnce(new Error('Redis unavailable'))
        .mockResolvedValue(2),
      getJob: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const repository = {
      findRecoverableSubmissions: vi.fn().mockResolvedValue([]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.recover();
    expect(repository.findRecoverableSubmissions).not.toHaveBeenCalled();

    await service.recover();
    expect(queue.setGlobalConcurrency).toHaveBeenCalledTimes(2);
    expect(repository.findRecoverableSubmissions).toHaveBeenCalledOnce();
  });
});
