import { JUDGE_SUBMISSION_JOB, JUDGING_JOB_OPTIONS } from '../queues/judging-queue.constants.js';
import { JudgingRecoveryService } from './judging-recovery.service.js';
import { JudgingRepository } from './judging.repository.js';

describe('JudgingRecoveryService', () => {
  it('re-enqueues recoverable submissions with idempotent job ids', async () => {
    const repository = {
      findRecoverableIds: vi.fn()
        .mockResolvedValueOnce(['submission-1'])
        .mockResolvedValueOnce([]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.onModuleInit();

    expect(repository.findRecoverableIds).toHaveBeenNthCalledWith(1, null, 100);
    expect(queue.add).toHaveBeenCalledWith(
      JUDGE_SUBMISSION_JOB,
      { submissionId: 'submission-1' },
      { jobId: 'submission-1', ...JUDGING_JOB_OPTIONS },
    );
    expect(repository.markQueued).toHaveBeenCalledWith('submission-1');
  });

  it('removes an exhausted retained job before recovering its nonterminal submission', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findRecoverableIds: vi.fn().mockResolvedValueOnce(['submission-1']).mockResolvedValueOnce([]),
      markQueued: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        getState: vi.fn().mockResolvedValue('failed'),
        remove,
      }),
      add: vi.fn().mockResolvedValue(undefined),
    };
    const service = new JudgingRecoveryService(
      repository as unknown as JudgingRepository,
      queue as never,
    );

    await service.onModuleInit();

    expect(remove).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledOnce();
  });
});
