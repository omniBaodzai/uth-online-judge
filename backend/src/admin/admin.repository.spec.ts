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
      query: vi.fn(async (sql: string) => (
        sql.includes('INSERT INTO problems') || sql.includes('UPDATE problems')
          ? { rows: [{ id: 'p1' }], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({} as never);
    const input = {
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, examples: [], status: 'published',
    } as never;

    await repository.saveProblem(input, 'user-1');
    await repository.saveProblem(input, 'user-1', 'p1');

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    const insert = sqls.find((sql) => sql.includes('INSERT INTO problems'))!;
    const update = sqls.find((sql) => sql.includes('UPDATE problems'))!;
    expect(insert).toContain('$11::varchar');
    expect(insert).not.toMatch(/\$11(?!::varchar|\d)/);
    expect(update).toContain('$12::varchar');
    expect(update).not.toMatch(/\$12(?!::varchar)/);
    const insertParams = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO problems'))![1] as unknown[];
    expect(insertParams[0]).toBe('uth011');
    expect(insertParams[10]).toBe('PUBLISHED');
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
});
