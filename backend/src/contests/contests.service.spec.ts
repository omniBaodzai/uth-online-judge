import { BadRequestException } from '@nestjs/common';
import { ContestsService } from './contests.service.js';
import type { ContestsRepository } from './contests.repository.js';

describe('ContestsService', () => {
  const repository = {
    list: vi.fn(),
    overview: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    replaceProblems: vi.fn(),
    publish: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  };
  let service: ContestsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContestsService(repository as unknown as ContestsRepository);
  });

  it('rejects invalid or reversed contest time windows before persistence', async () => {
    expect(() => service.create({
      slug: 'contest-2026',
      title: 'Contest',
      startsAt: '2026-11-02T10:00:00Z',
      endsAt: '2026-11-02T10:00:00Z',
    }, 'admin-id')).toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an update with an empty patch', async () => {
    expect(() => service.update('contest-id', {}, 'admin-id'))
      .toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate problems and non-positive scores', async () => {
    const problem = { problemId: '11111111-1111-4111-8111-111111111111', maxScore: 100 };
    expect(() => service.replaceProblems('contest-id', [problem, problem]))
      .toThrow(BadRequestException);
    expect(() => service.replaceProblems('contest-id', [{ ...problem, maxScore: 0 }]))
      .toThrow(BadRequestException);
    expect(repository.replaceProblems).not.toHaveBeenCalled();
  });

  it('allows private drafts but delegates publication restrictions to the repository', async () => {
    const input = {
      slug: 'private-contest',
      title: 'Private draft',
      startsAt: '2026-11-02T10:00:00Z',
      endsAt: '2026-11-02T12:00:00Z',
      visibility: 'PRIVATE' as const,
    };
    repository.create.mockResolvedValue({ id: 'contest-id' });

    await expect(service.create(input, 'admin-id')).resolves.toEqual({ id: 'contest-id' });
    expect(repository.create).toHaveBeenCalledWith(input, 'admin-id', null, undefined);
  });

  it('maps known PostgreSQL uniqueness failures to a conflict response', async () => {
    repository.create.mockRejectedValue({ code: '23505' });
    await expect(service.create({
      slug: 'duplicate-slug',
      title: 'Duplicate',
      startsAt: '2026-11-02T10:00:00Z',
      endsAt: '2026-11-02T12:00:00Z',
    }, 'admin-id')).rejects.toMatchObject({ status: 409 });
  });
});
