import { AdminRepository } from './admin.repository.js';

describe('AdminRepository', () => {
  it('uses bound parameters for admin list filters and maps persisted values', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'problem-1',
            problem_code: 'UTH001',
            title: 'Two values',
            summary: null,
            statement: 'Add values',
            difficulty: 'EASY',
            input_description: null,
            output_description: null,
            constraints_text: null,
            time_limit_ms: 1500,
            memory_limit_mb: 256,
            scoring_enabled: true,
            score: '75.50',
            status: 'DRAFT',
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
            tags: ['Math'],
            languages: ['C++'],
          }],
        }),
    };
    const repository = new AdminRepository(database as never);
    const hostile = "x%'; DROP TABLE problems; --";

    const result = await repository.listProblems({
      page: 2,
      pageSize: 10,
      search: hostile,
      status: 'draft',
      difficulty: 'easy',
    });

    expect(result).toMatchObject({
      total: 1,
      page: 2,
      items: [{
        id: 'problem-1',
        code: 'UTH001',
        difficulty: 'easy',
        status: 'draft',
        timeLimitSeconds: 1.5,
        score: 75.5,
        scoringEnabled: true,
        tags: ['Math'],
        languages: ['C++'],
      }],
    });
    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('DROP TABLE');
    expect(values).toEqual([`%x\\%'; DROP TABLE problems; --%`, 'DRAFT', 'EASY']);
  });

  it('casts the status parameter consistently when creating and updating problems', async () => {
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('INSERT INTO problems') || sql.startsWith('UPDATE problems')) {
          return { rows: [{ id: 'p1' }], rowCount: 1 };
        }
        if (sql.includes('p.score::text AS max_score')) {
          return { rows: [{ scoring_enabled: true, max_score: '100.00', assigned_points: '100.00', scored_test_count: '2', points_match: true }], rowCount: 1 };
        }
        if (sql.includes('SELECT scoring_enabled, score::text')) return { rows: [{ scoring_enabled: true, score: '100.00' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({} as never);
    const input = {
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: true, score: 100, examples: [], status: 'draft',
    } as never;

    await repository.saveProblem(input, 'user-1');
    await repository.saveProblem(input, 'user-1', 'p1');

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    const insert = sqls.find((sql) => sql.includes('INSERT INTO problems'))!;
    const update = sqls.find((sql) => sql.includes('UPDATE problems'))!;
    expect(insert).toContain('score, scoring_enabled, status, created_by');
    expect(insert).toContain('$13::varchar');
    expect(update).toContain('score = $12, scoring_enabled = $13, status = $14::varchar');
    const insertParams = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO problems'))![1] as unknown[];
    expect(insertParams[0]).toBe('uth011');
    expect(insertParams[10]).toBe(100);
    expect(insertParams[11]).toBe(true);
    expect(insertParams[12]).toBe('DRAFT');
    const updateParams = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE problems'))![1] as unknown[];
    expect(updateParams[11]).toBe(100);
    expect(updateParams[12]).toBe(true);
    expect(updateParams[13]).toBe('DRAFT');
  });

  it('rolls back publication when no test cases are configured', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO problems')) return { rows: [{ id: 'p1' }], rowCount: 1 };
        if (sql.includes('p.score::text AS max_score')) {
          return { rows: [{ scoring_enabled: true, max_score: '100.00', assigned_points: '0.00', scored_test_count: '1', points_match: false }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    const input = {
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: true, score: 100, examples: [], status: 'published',
    } as never;

    await expect(repository.saveProblem(input, 'user-1')).rejects.toThrow(/ít nhất một test case/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('saves a draft without requiring legacy weighted-scoring configuration', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO problems')) return { rows: [{ id: 'p1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({ scoringEnabled: false } as never);

    await repository.saveProblem({
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: false, examples: [], status: 'draft',
    } as never, 'user-1');

    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('p.scoring_enabled'), expect.anything());
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('preserves the dormant maximum when scoring is switched off', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT scoring_enabled, score::text')) {
          return { rows: [{ scoring_enabled: true, score: '80.00' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({ scoringEnabled: false } as never);

    await repository.saveProblem({
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: false, examples: [], status: 'draft',
    } as never, 'user-1', 'p1');

    const update = client.query.mock.calls.find(([sql]) => String(sql).includes('score = $12'))!;
    expect(update[1]?.[11]).toBe(80);
    expect(update[1]?.[12]).toBe(false);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('p.scoring_enabled'), expect.anything());
  });

  it('rejects publishing an existing problem with no active test cases', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT scoring_enabled, score::text')) {
          return { rows: [{ scoring_enabled: true, score: '100.00' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({ scoringEnabled: false } as never);

    await expect(repository.saveProblem({
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: false, examples: [], status: 'published',
    } as never, 'user-1', 'p1')).rejects.toThrow(/ít nhất một test case/i);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rejects stale collection revisions and rolls back without changing test cases', async () => {
    const client = {
      query: vi.fn(async (sql: string) => (
        sql.includes('SELECT test_case_revision, status')
          ? { rows: [{ test_case_revision: 8, status: 'DRAFT' }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      )),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.replaceTestCases('p1', 7, [])).rejects.toThrow(/thay đổi ở nơi khác/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE problem_test_cases SET position'), expect.anything());
  });

  it('preserves existing UUIDs and commits a reordered collection with fixed points', async () => {
    const existingId = '11111111-1111-4111-8111-111111111111';
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT test_case_revision, status')) return { rows: [{ test_case_revision: 3, status: 'DRAFT' }], rowCount: 1 };
        if (sql.includes('SELECT id FROM problem_test_cases')) return { rows: [{ id: existingId }], rowCount: 1 };
        if (sql.includes('SELECT MAX(position)')) return { rows: [{ position: 1 }], rowCount: 1 };
        if (sql.startsWith('UPDATE problem_test_cases\n           SET test_name')) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const database = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({
        rows: [{
          test_case_revision: 4,
          id: existingId,
          test_name: 'Mẫu',
          input_data: ' 1 \n',
          expected_output: ' 2\n',
          is_sample: true,
          points: '1',
          position: 1,
          is_active: true,
        }],
        rowCount: 1,
      }),
    };
    const repository = new AdminRepository(database as never);

    const result = await repository.replaceTestCases('p1', 3, [{
      id: existingId,
      name: 'Mẫu',
      input: ' 1 \n',
      expectedOutput: ' 2\n',
      kind: 'sample',
    }]);

    expect(result.cases[0]).toMatchObject({ id: existingId, input: ' 1 \n', expectedOutput: ' 2\n', points: 1, position: 1 });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('points = 1'),
      ['p1', existingId, 'Mẫu', ' 1 \n', ' 2\n', true, 1],
    );
  });

  it('rolls back the complete collection when a row write fails', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT test_case_revision, status')) return { rows: [{ test_case_revision: 0, status: 'DRAFT' }], rowCount: 1 };
        if (sql.includes('SELECT MAX(position)')) return { rows: [{ position: null }], rowCount: 1 };
        if (sql.includes('INSERT INTO problem_test_cases')) throw new Error('database write failed');
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.replaceTestCases('p1', 0, [{
      name: 'Test mới',
      input: '1',
      expectedOutput: '2',
      kind: 'hidden',
    }])).rejects.toThrow('database write failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});
