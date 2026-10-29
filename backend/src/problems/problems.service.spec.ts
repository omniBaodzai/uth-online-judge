import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProblemsService } from './problems.service.js';
import type { ProblemListQuery } from './problems.types.js';

const query: ProblemListQuery = { page: 2, pageSize: 5, sort: 'code', order: 'asc' };

describe('ProblemsService', () => {
  const repository = {
    listPublished: vi.fn(),
    findTagsForProblems: vi.fn(),
    listTags: vi.fn(),
    findPublishedByCode: vi.fn(),
    findPublishedProblemForEditorial: vi.fn(),
    hasFinalizedSubmission: vi.fn(),
    findPublishedEditorials: vi.fn(),
    findSamples: vi.fn(),
    listProblemLanguages: vi.fn(),
  };
  const service = new ProblemsService(repository as never);

  beforeEach(() => vi.resetAllMocks());

  it('attaches tags to list items and returns pagination metadata', async () => {
    repository.listPublished.mockResolvedValue({
      total: 7,
      ids: ['a', 'b'],
      rows: [{ code: 'A' }, { code: 'B' }],
    });
    repository.findTagsForProblems.mockResolvedValue(new Map([['a', [{ name: 'Toán', slug: 'math' }]]]));

    const result = await service.list(query, 'user-1');

    expect(repository.listPublished).toHaveBeenCalledWith(query, 'user-1');
    expect(result).toEqual({
      items: [
        { code: 'A', tags: [{ name: 'Toán', slug: 'math' }] },
        { code: 'B', tags: [] },
      ],
      page: 2,
      pageSize: 5,
      total: 7,
    });
  });

  it('throws NotFound for unknown or unpublished problems', async () => {
    repository.findPublishedByCode.mockResolvedValue(null);
    await expect(service.getByCode('NOPE', null)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findSamples).not.toHaveBeenCalled();
  });

  it('builds the detail without leaking the internal id', async () => {
    repository.findPublishedByCode.mockResolvedValue({ id: 'p1', code: 'UTH001', title: 'T' });
    repository.findTagsForProblems.mockResolvedValue(new Map([['p1', [{ name: 'Toán', slug: 'math' }]]]));
    repository.findSamples.mockResolvedValue([{ input: '1', output: '2' }]);
    repository.listProblemLanguages.mockResolvedValue([{ slug: 'cpp', name: 'C++', version: null }]);

    const detail = await service.getByCode('UTH001', null);

    expect(detail).toEqual({
      code: 'UTH001',
      title: 'T',
      tags: [{ name: 'Toán', slug: 'math' }],
      examples: [{ input: '1', output: '2' }],
      languages: [{ slug: 'cpp', name: 'C++', version: null }],
    });
    expect(detail).not.toHaveProperty('id');
  });

  it('does not fetch source code unless the authenticated user has a finalized submission', async () => {
    repository.findPublishedProblemForEditorial.mockResolvedValue({
      id: 'p1',
      code: 'UTH001',
      title: 'Tổng hai số',
    });
    repository.hasFinalizedSubmission.mockResolvedValue(false);

    await expect(service.getEditorial('UTH001', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.hasFinalizedSubmission).toHaveBeenCalledWith('p1', 'user-1');
    expect(repository.findPublishedEditorials).not.toHaveBeenCalled();
  });

  it('returns solutions, including an empty collection, after any finalized verdict', async () => {
    repository.findPublishedProblemForEditorial.mockResolvedValue({
      id: 'p1',
      code: 'UTH001',
      title: 'Tổng hai số',
    });
    repository.hasFinalizedSubmission.mockResolvedValue(true);
    repository.findPublishedEditorials.mockResolvedValue([]);

    await expect(service.getEditorial('UTH001', 'user-1')).resolves.toEqual({
      problem: { code: 'UTH001', title: 'Tổng hai số' },
      editorials: [],
    });
    expect(repository.findPublishedEditorials).toHaveBeenCalledWith('p1');
  });

  it('does not reveal solutions for unknown or unpublished problems', async () => {
    repository.findPublishedProblemForEditorial.mockResolvedValue(null);

    await expect(service.getEditorial('NOPE', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.hasFinalizedSubmission).not.toHaveBeenCalled();
    expect(repository.findPublishedEditorials).not.toHaveBeenCalled();
  });
});
