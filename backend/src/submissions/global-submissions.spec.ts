import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GlobalSubmissionsQueryDto } from './dto/global-submissions.dto.js';
import { buildGlobalStatistics, escapeLikePattern } from './global-submissions.js';
import { SubmissionsRepository } from './submissions.repository.js';
import { SubmissionsService } from './submissions.service.js';

async function validateQuery(input: Record<string, unknown>) {
  const dto = plainToInstance(GlobalSubmissionsQueryDto, input);
  return { dto, errors: await validate(dto) };
}

describe('global submissions query validation', () => {
  it('uses safe defaults and trims the search keyword', async () => {
    const { dto, errors } = await validateQuery({ q: '  uth011  ' });
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 10, q: 'uth011' });
  });

  it.each([
    [{ page: '0' }],
    [{ page: 'abc' }],
    [{ pageSize: '51' }],
    [{ pageSize: '0' }],
    [{ status: 'HACKED' }],
    [{ language: "C++'; DROP TABLE submissions;--" }],
    [{ q: 'x'.repeat(101) }],
  ])('rejects invalid input %j', async (input) => {
    const { errors } = await validateQuery(input);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts every supported verdict and language names', async () => {
    const { errors } = await validateQuery({ status: 'INTERNAL_ERROR', language: 'C++ (GCC 9.2.0)' });
    expect(errors).toHaveLength(0);
  });
});

describe('global submission helpers', () => {
  it('escapes LIKE wildcards so keywords are literal', () => {
    expect(escapeLikePattern('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('keeps total, accepted, rate and verdict counts consistent', () => {
    const stats = buildGlobalStatistics([
      { status: 'ACCEPTED', count: 2 },
      { status: 'WRONG_ANSWER', count: 2 },
      { status: 'COMPILATION_ERROR', count: 1 },
      { status: 'QUEUED', count: '1' },
    ]);
    expect(stats).toEqual({
      total: 6,
      accepted: 2,
      acceptanceRate: 33.3,
      verdictCounts: { ACCEPTED: 2, WRONG_ANSWER: 2, COMPILATION_ERROR: 1, QUEUED: 1 },
    });
    expect(Object.values(stats.verdictCounts).reduce((a, b) => a + b, 0)).toBe(stats.total);
  });

  it('returns zeroes for an empty database without dividing by zero', () => {
    expect(buildGlobalStatistics([])).toEqual({ total: 0, accepted: 0, acceptanceRate: 0, verdictCounts: {} });
  });
});

describe('SubmissionsRepository.findGlobalSubmissions', () => {
  const query = vi.fn();
  const repository = new SubmissionsRepository({ query } as never);
  const base = { page: 2, pageSize: 20 };

  function mockDatabase(items: unknown[], total: number) {
    query
      .mockResolvedValueOnce({ rows: [{ items, total }] })
      .mockResolvedValueOnce({ rows: [{ status: 'ACCEPTED', count: 1 }, { status: 'RUNNING', count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'C++' }, { name: 'Python' }] });
  }

  beforeEach(() => query.mockReset());

  it('maps rows, flags only the viewer’s own submissions and keeps pending rows', async () => {
    mockDatabase(
      [
        {
          id: 'a', status: 'RUNNING', submitted_at: '2026-10-23T10:00:00Z', username: 'alice',
          problem_code: 'UTH011', problem_title: 'Tổng hai số', language: 'C++',
          execution_time_ms: null, memory_used_kb: null, is_owner: true,
        },
        {
          id: 'b', status: 'ACCEPTED', submitted_at: '2026-10-23T09:00:00Z', username: null,
          problem_code: 'UTH012', problem_title: 'Bài 2', language: 'Python',
          execution_time_ms: 26, memory_used_kb: 2048, is_owner: false,
        },
      ],
      42,
    );

    const page = await repository.findGlobalSubmissions('viewer-1', base);

    expect(page.total).toBe(42);
    expect(page).toMatchObject({ page: 2, pageSize: 20 });
    expect(page.items[0]).toMatchObject({ status: 'RUNNING', executionTimeMs: null, memoryUsedKb: null, canViewDetails: true });
    expect(page.items[1]).toMatchObject({ username: null, executionTimeMs: 26, memoryUsedKb: 2048, canViewDetails: false });
    expect(page.statistics).toMatchObject({ total: 2, accepted: 1, acceptanceRate: 50 });
    expect(page.filters.languages).toEqual(['C++', 'Python']);
    expect(Object.keys(page.items[0]).sort()).toEqual(
      ['canViewDetails', 'executionTimeMs', 'id', 'language', 'memoryUsedKb', 'problemCode', 'problemTitle', 'status', 'submittedAt', 'username'],
    );
  });

  it('passes every filter as a bound parameter, never inline', async () => {
    mockDatabase([], 0);
    await repository.findGlobalSubmissions('viewer-1', {
      ...base, q: "a'; DROP TABLE users;--%", status: 'WRONG_ANSWER', language: 'C++',
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['WRONG_ANSWER', 'C++', "%a'; DROP TABLE users;--\\%%", 20, 20, 'viewer-1']);
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('ORDER BY submitted_at DESC, id DESC');
  });

  it('only reads published problems and never selects source code or Judge0 data', async () => {
    mockDatabase([], 0);
    await repository.findGlobalSubmissions('viewer-1', base);

    for (const [sql] of query.mock.calls as Array<[string]>) {
      expect(sql).toContain("p.status = 'PUBLISHED'");
      expect(sql).not.toMatch(/source_code|judge0_token|error_message|input_data|expected_output|email|password/i);
    }
  });

  it('handles an empty database', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ items: [], total: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const page = await repository.findGlobalSubmissions('viewer-1', { page: 1, pageSize: 10 });
    expect(page).toMatchObject({
      items: [], total: 0,
      statistics: { total: 0, accepted: 0, acceptanceRate: 0, verdictCounts: {} },
      filters: { languages: [] },
    });
  });
});

describe('SubmissionsService.getGlobalSubmissions', () => {
  it('delegates with the authenticated viewer id', async () => {
    const findGlobalSubmissions = vi.fn().mockResolvedValue({ items: [] });
    const service = new SubmissionsService({ findGlobalSubmissions } as never, {} as never);
    const input = { page: 1, pageSize: 10, q: 'abc' };

    await service.getGlobalSubmissions('user-9', input);
    expect(findGlobalSubmissions).toHaveBeenCalledWith('user-9', input);
  });
});
