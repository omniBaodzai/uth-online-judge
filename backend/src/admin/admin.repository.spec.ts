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
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: true, score: 100, examples: [], status: 'published',
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
    expect(insertParams[12]).toBe('PUBLISHED');
    const updateParams = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE problems'))![1] as unknown[];
    expect(updateParams[11]).toBe(100);
    expect(updateParams[12]).toBe(true);
    expect(updateParams[13]).toBe('PUBLISHED');
  });

  it('rolls back publication when hidden-test points do not match the problem maximum', async () => {
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

    await expect(repository.saveProblem(input, 'user-1')).rejects.toThrow(/tổng điểm test ẩn/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('publishes an unscored problem without requiring hidden-test weights', async () => {
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
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: false, examples: [], status: 'published',
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

  it('allows publishing an existing problem after disabling scoring, even with zero test points', async () => {
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

    await repository.saveProblem({
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, scoringEnabled: false, examples: [], status: 'published',
    } as never, 'user-1', 'p1');

    const update = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE problems'))!;
    expect(update[1]?.[11]).toBe(100);
    expect(update[1]?.[12]).toBe(false);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('p.score::text AS max_score'),
      expect.anything(),
    );
  });

  it('preserves exact input and output whitespace when saving a test case', async () => {
    const created = {
      id: 'case-1',
      test_name: 'Whitespace case',
      input_data: '',
      expected_output: '  result\n\n',
      is_sample: false,
      points: '0',
      position: 4,
      is_active: true,
    };
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO problem_test_cases')) return { rows: [created], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 }),
      connect: vi.fn().mockResolvedValue(client),
    };
    const repository = new AdminRepository(database as never);

    const result = await repository.saveTestCase('problem-1', {
      name: 'Whitespace case',
      input: '',
      expectedOutput: '  result\n\n',
      kind: 'hidden',
    });

    expect(result.input).toBe('');
    expect(result.expectedOutput).toBe('  result\n\n');
    const insertCall = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO problem_test_cases'));
    expect(insertCall?.[1]).toEqual(['problem-1', 'Whitespace case', '', '  result\n\n', false, 0, null]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('keeps public examples unscored even if a client sends points', async () => {
    const created = {
      id: 'case-sample',
      test_name: 'Example',
      input_data: '1',
      expected_output: '1',
      is_sample: true,
      points: '0',
      position: 1,
      is_active: true,
    };
    const client = {
      query: vi.fn(async (sql: string) => (
        sql.includes('INSERT INTO problem_test_cases')
          ? { rows: [created], rowCount: 1 }
          : { rows: [{ id: 'problem-1', status: 'DRAFT' }], rowCount: 1 }
      )),
      release: vi.fn(),
    };
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 }),
      connect: vi.fn().mockResolvedValue(client),
    };
    const repository = new AdminRepository(database as never);

    await repository.saveTestCase('problem-1', {
      name: 'Example',
      input: '1',
      expectedOutput: '1',
      kind: 'sample',
      points: 25,
    });

    const insertCall = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO problem_test_cases'));
    expect(insertCall?.[1]).toEqual(['problem-1', 'Example', '1', '1', true, 0, null]);
  });

  it('distributes hundred points deterministically across hidden test cases', async () => {
    const hiddenCases = [
      { id: 'case-1', position: 1 },
      { id: 'case-2', position: 2 },
      { id: 'case-3', position: 3 },
    ];
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT score::text')) return { rows: [{ score: '100.00', scoring_enabled: true }], rowCount: 1 };
        if (sql.includes('SELECT id, position')) return { rows: hiddenCases, rowCount: 3 };
        return { rows: [], rowCount: 3 };
      }),
      release: vi.fn(),
    };
    const database = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(async (sql: string) => (
        sql.includes('SELECT 1 FROM problems')
          ? { rows: [{ '?column?': 1 }], rowCount: 1 }
          : {
              rows: hiddenCases.map((testCase, index) => ({
                id: testCase.id,
                test_name: `Test ${index + 1}`,
                input_data: '',
                expected_output: 'ok',
                is_sample: false,
                points: ['33.34', '33.33', '33.33'][index],
                position: index + 1,
                is_active: true,
              })),
              rowCount: 3,
            }
      )),
    };
    const repository = new AdminRepository(database as never);

    const result = await repository.distributeTestCasePoints('p1');

    expect(result.map((testCase) => testCase.points)).toEqual([33.34, 33.33, 33.33]);
    const updateCall = client.query.mock.calls.find(([sql]) => sql.includes('UPDATE problem_test_cases AS test_case'));
    expect(updateCall?.[1]).toEqual(['case-1', '33.34', 'case-2', '33.33', 'case-3', '33.33', 'p1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
