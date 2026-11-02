import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudentContestsService } from './student-contests.service.js';
import type { StudentContestsRepository } from './student-contests.repository.js';

const userId = 'c0a80101-0000-4000-8000-000000000002';

describe('StudentContestsService', () => {
  const repository = {
    list: vi.fn(),
    findPublic: vi.fn(),
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
});
