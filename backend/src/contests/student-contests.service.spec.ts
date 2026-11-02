import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudentContestsService } from './student-contests.service.js';
import type { StudentContestsRepository } from './student-contests.repository.js';

const userId = 'c0a80101-0000-4000-8000-000000000002';

describe('StudentContestsService', () => {
  const repository = {
    list: vi.fn(),
    findPublic: vi.fn(),
    findPublicStatistics: vi.fn(),
    findPublicLeaderboard: vi.fn(),
    findPublicParticipants: vi.fn(),
    findPublicSubmissions: vi.fn(),
    register: vi.fn(),
    cancel: vi.fn(),
  };
  let service: StudentContestsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StudentContestsService(repository as unknown as StudentContestsRepository);
  });

  it('delegates public listing and detail lookup without weakening repository visibility checks', async () => {
    repository.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    repository.findPublic.mockResolvedValue({ id: 'contest-id' });

    const query = {
      page: 1,
      pageSize: 20,
      sort: 'startsAt',
      order: 'asc',
    } as const;
    await expect(service.list(query, userId)).resolves.toMatchObject({ total: 0 });
    expect(repository.list).toHaveBeenCalledWith(query, userId);
    await expect(service.get('contest-slug', null)).resolves.toEqual({ id: 'contest-id' });
    expect(repository.findPublic).toHaveBeenCalledWith('contest-slug', null);
  });

  it('maps database registration trigger and uniqueness failures to conflicts', async () => {
    repository.register.mockRejectedValueOnce({ code: '55000' });
    await expect(service.register('contest-id', 'student-id'))
      .rejects.toBeInstanceOf(ConflictException);

    repository.cancel.mockRejectedValueOnce({ code: '23505' });
    await expect(service.cancel('contest-id', 'student-id'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves explicit not-found responses for hidden or missing contests', async () => {
    repository.findPublic.mockRejectedValueOnce(new NotFoundException());
    await expect(service.get('private-slug', null)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates public contest statistics and preserves not-found responses', async () => {
    const statistics = { totalParticipants: 1, totalSubmissions: 0 };
    repository.findPublicStatistics.mockResolvedValue(statistics);
    await expect(service.statistics('uth-challenge')).resolves.toEqual(statistics);
    expect(repository.findPublicStatistics).toHaveBeenCalledWith('uth-challenge');

    repository.findPublicStatistics.mockRejectedValueOnce(new NotFoundException());
    await expect(service.statistics('hidden-contest')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates leaderboard paging and preserves hidden-contest not-found responses', async () => {
    const query = { page: 2, pageSize: 20, search: 'coder' } as const;
    const page = { items: [], total: 0, page: 2, pageSize: 20 };
    repository.findPublicLeaderboard.mockResolvedValue(page);
    await expect(service.leaderboard('uth-challenge', query)).resolves.toEqual(page);
    expect(repository.findPublicLeaderboard).toHaveBeenCalledWith('uth-challenge', query);

    repository.findPublicLeaderboard.mockRejectedValueOnce(new NotFoundException());
    await expect(service.leaderboard('hidden-contest', query))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates participant paging and preserves hidden-contest not-found responses', async () => {
    const query = {
      page: 2,
      pageSize: 20,
      search: 'coder',
      status: 'participated',
    } as const;
    const page = { items: [], total: 0, participantCount: 0, page: 2, pageSize: 20 };
    repository.findPublicParticipants.mockResolvedValue(page);
    await expect(service.participants('uth-challenge', query)).resolves.toEqual(page);
    expect(repository.findPublicParticipants).toHaveBeenCalledWith('uth-challenge', query);

    repository.findPublicParticipants.mockRejectedValueOnce(new NotFoundException());
    await expect(service.participants('hidden-contest', query))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates contest submissions with viewer identity and query filters', async () => {
    const query = { page: 1, pageSize: 10, search: 'UTH', status: 'ACCEPTED' } as const;
    const page = { items: [], total: 0, page: 1, pageSize: 10 };
    repository.findPublicSubmissions.mockResolvedValue(page);
    await expect(service.submissions('uth-challenge', query, userId)).resolves.toEqual(page);
    expect(repository.findPublicSubmissions).toHaveBeenCalledWith(
      'uth-challenge',
      query,
      userId,
    );

    repository.findPublicSubmissions.mockRejectedValueOnce(new NotFoundException());
    await expect(service.submissions('hidden-contest', query, null))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
