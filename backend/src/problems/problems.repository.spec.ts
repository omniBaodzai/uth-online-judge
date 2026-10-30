import { ProblemsRepository, escapeLike } from './problems.repository.js';
import type { ProblemListQuery } from './problems.types.js';

const baseQuery: ProblemListQuery = { page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' };

describe('ProblemsRepository', () => {
  const database = { query: vi.fn() };
  let repository: ProblemsRepository;

  beforeEach(() => {
    database.query.mockReset();
    repository = new ProblemsRepository(database as never);
  });

  describe('listPublished', () => {
    beforeEach(() => {
      database.query
        .mockResolvedValueOnce({ rows: [{ total: '41' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'p1',
              problem_code: 'UTH001',
              title: 'Tổng hai số',
              difficulty: 'EASY',
              scoring_enabled: true,
              score: '100.00',
              published_at: new Date('2026-01-02T00:00:00.000Z'),
              ac_count: '12',
              acceptance_rate: '89.4',
              has_solution: true,
              user_status: 'solved',
            },
          ],
        });
    });

    it('maps rows to API items and never selects judging data', async () => {
      const result = await repository.listPublished(baseQuery, 'user-1');

      expect(result.total).toBe(41);
      expect(result.ids).toEqual(['p1']);
      expect(result.rows[0]).toEqual({
        code: 'UTH001',
        title: 'Tổng hai số',
        difficulty: 'EASY',
        scoringEnabled: true,
        points: 100,
        acceptanceRate: 89.4,
        acCount: 12,
        status: 'solved',
        hasSolution: true,
        publishedAt: '2026-01-02T00:00:00.000Z',
      });
      const sql = database.query.mock.calls.map(([text]) => text).join('\n');
      expect(sql).toContain("p.status = 'PUBLISHED'");
      expect(sql).not.toContain('expected_output');
      expect(sql).not.toContain('input_data');
      expect(sql).not.toContain('content_markdown');
    });

    it('passes user-controlled filters as bound parameters, not SQL text', async () => {
      const hostile = "x'; DROP TABLE problems; --";
      await repository.listPublished(
        { ...baseQuery, search: hostile, tags: ['math'], status: 'wrong', page: 3, pageSize: 10 },
        null,
      );

      const [countSql, countValues] = database.query.mock.calls[0];
      const [pageSql, pageValues] = database.query.mock.calls[1];
      expect(countSql).not.toContain('DROP TABLE');
      expect(pageSql).not.toContain('DROP TABLE');
      expect(countValues).toEqual([null, `%${hostile}%`, ['math'], 'wrong']);
      expect(pageValues).toEqual([null, `%${hostile}%`, ['math'], 'wrong', 10, 20]);
      expect(pageSql).toMatch(/LIMIT \$5 OFFSET \$6/);
    });

    it('uses only whitelisted ORDER BY expressions', async () => {
      await repository.listPublished({ ...baseQuery, sort: 'difficulty', order: 'desc' }, null);
      const pageSql = database.query.mock.calls[1][0] as string;
      expect(pageSql).toContain("CASE difficulty WHEN 'EASY' THEN 1");
      expect(pageSql).toMatch(/DESC NULLS LAST, id DESC/);
    });

    it('sorts by newest creation time with a stable id tie-breaker before pagination', async () => {
      await repository.listPublished(
        { ...baseQuery, page: 2, pageSize: 10, search: 'new', tags: ['math'], status: 'solved' },
        'user-1',
      );
      const [countSql, countValues] = database.query.mock.calls[0];
      const [pageSql, pageValues] = database.query.mock.calls[1];

      expect(pageSql).toContain('p.created_at');
      expect(pageSql).toMatch(/ORDER BY created_at DESC NULLS LAST, id DESC\s+LIMIT \$5 OFFSET \$6/);
      expect(pageValues).toEqual([...countValues, 10, 10]);
      expect(pageSql.indexOf('ORDER BY created_at DESC')).toBeLessThan(pageSql.indexOf('LIMIT $5'));
      expect(countSql).toContain('WHERE');
    });
  });

  it('escapes LIKE wildcards in search terms', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('returns no tag query work for an empty id list', async () => {
    await expect(repository.findTagsForProblems([])).resolves.toEqual(new Map());
    expect(database.query).not.toHaveBeenCalled();
  });

  it('groups tags by problem', async () => {
    database.query.mockResolvedValue({
      rows: [
        { problem_id: 'a', name: 'Mảng', slug: 'arrays' },
        { problem_id: 'a', name: 'Toán', slug: 'math' },
        { problem_id: 'b', name: 'Chuỗi', slug: 'strings' },
      ],
    });
    const tags = await repository.findTagsForProblems(['a', 'b']);
    expect(tags.get('a')).toHaveLength(2);
    expect(tags.get('b')).toEqual([{ name: 'Chuỗi', slug: 'strings' }]);
  });

  it('only reads sample, active test cases and only their input/output', async () => {
    database.query.mockResolvedValue({ rows: [{ input_data: '1 2', expected_output: '3' }] });
    await expect(repository.findSamples('p1')).resolves.toEqual([{ input: '1 2', output: '3' }]);

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('is_sample = TRUE');
    expect(sql).toContain('is_active = TRUE');
    expect(values).toEqual(['p1']);
  });

  it('looks up details by code restricted to published problems', async () => {
    database.query.mockResolvedValue({ rows: [] });
    await expect(repository.findPublishedByCode('NOPE', null)).resolves.toBeNull();

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain("p.status = 'PUBLISHED'");
    expect(sql).not.toContain('password_hash');
    expect(sql).not.toContain('email');
    expect(values).toEqual([null, 'NOPE']);
  });

  it('requires an owned finalized submission and excludes every queued judging status', async () => {
    database.query.mockResolvedValueOnce({ rows: [{ eligible: true }] });

    await expect(repository.hasFinalizedSubmission('problem-1', 'user-1')).resolves.toBe(true);

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain("status NOT IN ('PENDING', 'QUEUED', 'RUNNING', 'PROCESSING')");
    expect(sql).not.toContain('ACCEPTED');
    expect(values).toEqual(['problem-1', 'user-1']);
  });

  it('selects only published solution source and maps each language independently', async () => {
    database.query.mockResolvedValueOnce({
      rows: [{ id: 'editorial-1', title: 'Python', language: 'Python', source_code: 'print(1)' }],
    });

    await expect(repository.findPublishedEditorials('problem-1')).resolves.toEqual([
      { id: 'editorial-1', title: 'Python', language: 'Python', sourceCode: 'print(1)' },
    ]);

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('source_code');
    expect(sql).toContain('is_published = TRUE');
    expect(values).toEqual(['problem-1']);
  });
});
