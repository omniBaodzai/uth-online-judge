import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DEMO_QUEUE, UPPERCASE_TEXT_JOB } from './demo-queue.constants.js';
import { DemoQueueProcessor } from './demo-queue.processor.js';
import { DemoQueueService } from './demo-queue.service.js';

describe('DemoQueueService', () => {
  const queue = { add: vi.fn(), getJob: vi.fn() };
  let service: DemoQueueService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [DemoQueueService, { provide: getQueueToken(DEMO_QUEUE), useValue: queue }],
    }).compile();
    service = moduleRef.get(DemoQueueService);
  });

  it('adds an uppercase-text job with a unique id and retry options', async () => {
    queue.add.mockResolvedValue({});
    const first = await service.enqueueUppercase('hello');
    const second = await service.enqueueUppercase('hello');

    expect(first.jobId).not.toBe(second.jobId);
    expect(queue.add).toHaveBeenCalledWith(
      UPPERCASE_TEXT_JOB,
      { text: 'hello' },
      expect.objectContaining({
        jobId: first.jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });

  it('hides internal errors when enqueueing fails', async () => {
    queue.add.mockRejectedValue(new Error('ECONNREFUSED redis:6379'));
    const error = await service.enqueueUppercase('x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain(
      'ECONNREFUSED',
    );
  });

  it('reports the result only once the job is completed', async () => {
    queue.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('completed'),
      returnvalue: { text: 'HELLO' },
    });
    await expect(service.getStatus('id')).resolves.toEqual({
      jobId: 'id',
      state: 'completed',
      result: { text: 'HELLO' },
    });

    queue.getJob.mockResolvedValue({ getState: vi.fn().mockResolvedValue('waiting') });
    await expect(service.getStatus('id')).resolves.toEqual({ jobId: 'id', state: 'waiting' });
  });

  it('throws NotFound for unknown jobs', async () => {
    queue.getJob.mockResolvedValue(undefined);
    await expect(service.getStatus('id')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DemoQueueProcessor', () => {
  const processor = new DemoQueueProcessor();
  const job = (name: string, data: unknown) => ({ id: '1', name, data }) as never;

  it('transforms text to uppercase', async () => {
    await expect(processor.process(job(UPPERCASE_TEXT_JOB, { text: 'uth Judge' }))).resolves.toEqual({
      text: 'UTH JUDGE',
    });
  });

  it('rejects unsupported job names and invalid payloads', async () => {
    await expect(processor.process(job('other', { text: 'a' }))).rejects.toThrow('Unsupported');
    await expect(processor.process(job(UPPERCASE_TEXT_JOB, { text: 5 }))).rejects.toThrow(
      'Invalid job payload',
    );
  });
});
