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
