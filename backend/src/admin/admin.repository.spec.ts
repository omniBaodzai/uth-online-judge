import { AdminRepository } from './admin.repository.js';

describe('AdminRepository', () => {
  it.each([
    [7, 'GLOBAL'],
    [30, 'ORGANIZATION'],
    [90, 'GLOBAL'],
  ] as const)('returns %s days of zero-filled %s dashboard series in Vietnam time', async (days, scope) => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { date: '2026-11-09', submissions_count: '0', users_count: '1' },
          { date: '2026-11-10', submissions_count: '3', users_count: '0' },
        ],
      }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.dashboardStatistics(days, scope)).resolves.toEqual({
      timezone: 'Asia/Ho_Chi_Minh',
      days,
      submissionScope: scope,
      submissions: {
        total: 3,
        daily: [
          { date: '2026-11-09', count: 0 },
          { date: '2026-11-10', count: 3 },
        ],
      },
      users: {
        total: 1,
        daily: [
          { date: '2026-11-09', count: 1 },
          { date: '2026-11-10', count: 0 },
        ],
      },
    });

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([days, scope]);
    expect(sql).toContain("AT TIME ZONE 'Asia/Ho_Chi_Minh'");
    expect(sql).toContain('generate_series(');
    expect(sql).toContain("problem.status = 'PUBLISHED'");
    expect(sql).toContain('problem.organization_id IS NULL');
    expect(sql).toContain("COALESCE(contest.organization_id, problem.organization_id) IS NOT NULL");
    expect(sql).toContain('COUNT(DISTINCT submission.id)');
    expect(sql).not.toMatch(/submission\.(?:status|verdict)\s*=/);
    expect(sql).toContain("COALESCE(daily_submissions.count, '0')");
    expect(sql).toContain("COALESCE(daily_users.count, '0')");
    expect(sql).toContain('submission.submitted_at >=');
    expect(sql).toContain('user_account.created_at >=');
  });

  it('uses the selected 30-day window for the chart total', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { date: '2026-10-12', submissions_count: '1', users_count: '0' },
          { date: '2026-11-10', submissions_count: '3', users_count: '0' },
        ],
      }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.dashboardStatistics(30, 'GLOBAL')).resolves.toMatchObject({
      days: 30,
      submissions: {
        total: 4,
        daily: [
          { date: '2026-10-12', count: 1 },
          { date: '2026-11-10', count: 3 },
        ],
      },
    });

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([30, 'GLOBAL']);
    expect(sql).toContain("problem.status = 'PUBLISHED'");
    expect(sql).toContain('submission.submitted_at >=');
    expect(sql).toContain('submission.submitted_at <');
  });

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
            is_hidden: true,
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
      visibility: 'hidden',
    });

    expect(result).toMatchObject({
      total: 1,
      page: 2,
      items: [{
        id: 'problem-1',
        code: 'UTH001',
        difficulty: 'easy',
        status: 'draft',
        isHidden: true,
        timeLimitSeconds: 1.5,
        score: 75.5,
        scoringEnabled: true,
        tags: ['Math'],
        languages: ['C++'],
      }],
    });
    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('p.is_hidden = $5');
    expect(values).toEqual([null, `%x\\%'; DROP TABLE problems; --%`, 'DRAFT', 'EASY', true]);
  });

  it('changes only the visibility flag of a published global problem', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'problem-1', status: 'PUBLISHED', is_hidden: true }],
        rowCount: 1,
      }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('problem-1', true)).resolves.toEqual({
      id: 'problem-1',
      status: 'published',
      isHidden: true,
    });

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE problems\s+SET is_hidden = \$2/i);
    expect(sql).toContain("organization_id IS NULL AND status = 'PUBLISHED'");
    expect(sql).toContain('RETURNING id, status, is_hidden');
    expect(sql).not.toContain('published_at =');
    expect(sql).not.toContain('updated_at =');
    expect(values).toEqual(['problem-1', true]);
    expect(database.query).toHaveBeenCalledOnce();
  });

  it('allows idempotent visibility updates and returns the persisted state', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'problem-1', status: 'PUBLISHED', is_hidden: false }],
        rowCount: 1,
      }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('problem-1', false)).resolves.toEqual({
      id: 'problem-1',
      status: 'published',
      isHidden: false,
    });
    expect(database.query).toHaveBeenCalledOnce();
  });

  it.each([
    [true, 'ẩn'],
    [false, 'hiện'],
  ] as const)('maps only the active-contest trigger to a contextual 409 when %s', async (isHidden, action) => {
    const triggerError = Object.assign(
      new Error('Problem data cannot be changed while its contest is running.'),
      { code: '55000' },
    );
    const database = { query: vi.fn().mockRejectedValue(triggerError) };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('problem-1', isHidden))
      .rejects.toThrow(`Không thể ${action} bài tập vì bài tập đang thuộc một cuộc thi diễn ra. Vui lòng thử lại sau khi cuộc thi kết thúc.`);
    expect(database.query).toHaveBeenCalledOnce();
  });

  it.each([
    ['55000', 'A different database condition.'],
    ['23505', 'Problem data cannot be changed while its contest is running.'],
  ])('does not convert unrelated database errors (%s)', async (code, message) => {
    const databaseError = Object.assign(new Error(message), { code });
    const database = { query: vi.fn().mockRejectedValue(databaseError) };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('problem-1', true))
      .rejects.toBe(databaseError);
  });

  it('rejects non-published problems and hides organization problem existence from the global API', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ status: 'DRAFT' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('draft-problem', true))
      .rejects.toThrow(/chỉ bài tập đã xuất bản/i);
    await expect(repository.setProblemVisibility('organization-problem', true))
      .rejects.toThrow(/không tìm thấy bài tập/i);

    expect(database.query.mock.calls[0]?.[0]).toContain("status = 'PUBLISHED'");
    expect(database.query.mock.calls[0]?.[0]).toContain('organization_id IS NULL');
    expect(database.query.mock.calls[1]?.[0]).toContain('organization_id IS NULL');
    expect(database.query.mock.calls[3]?.[0]).toContain('organization_id IS NULL');
  });

  it('returns not found when the requested global problem does not exist', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.setProblemVisibility('missing-problem', true))
      .rejects.toThrow(/không tìm thấy bài tập/i);
    expect(database.query).toHaveBeenCalledTimes(2);
  });

  it('rechecks organization manager membership after locking the organization row', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status FROM public.organizations')) {
          return { rows: [{ status: 'ACTIVE' }], rowCount: 1 };
        }
        if (sql.includes('FROM public.organization_members')) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.saveProblem(
      { code: 'uth011', title: 'T', statement: 'S', tags: [], languages: [] } as never,
      'user-1',
      undefined,
      'organization-id',
      { userId: 'user-1', isSystemAdmin: false },
    )).rejects.toThrow(/không còn quyền quản lý/i);

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.indexOf('BEGIN')).toBeLessThan(sqls.findIndex((sql) => sql.includes('SELECT status FROM public.organizations')));
    expect(sqls.findIndex((sql) => sql.includes('FROM public.organization_members')))
      .toBeGreaterThan(sqls.findIndex((sql) => sql.includes('SELECT status FROM public.organizations')));
    expect(sqls.some((sql) => sql.includes('INSERT INTO problems'))).toBe(false);
    expect(sqls.at(-1)).toBe('ROLLBACK');
  });

  it('persists organization-created problems with the resolved organization ID', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status FROM public.organizations')) {
          return { rows: [{ status: 'ACTIVE' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO problems')) {
          return { rows: [{ id: 'organization-problem-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({ id: 'organization-problem-id' } as never);

    await repository.saveProblem({
      code: 'navi_task_1',
      title: 'NAVI task',
      statement: 'Solve the problem.',
      tags: [],
      languages: [],
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      status: 'draft',
    } as never, 'system-admin-id', undefined, 'navi-organization-id', {
      userId: 'system-admin-id',
      isSystemAdmin: true,
    });

    const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO problems'));
    expect(insert?.[0]).toContain('organization_id)');
    expect(insert?.[1]).toContain('navi-organization-id');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('does not expose organization hidden test cases unless the actor is a manager', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    const repository = new AdminRepository(database as never);

    await expect(repository.listTestCases('problem-id', 'organization-id')).rejects.toThrow(
      /không tìm thấy bài tập/i,
    );

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("om.role IN ('OWNER', 'ADMIN')");
    expect(sql).toContain("o.status = 'ACTIVE'");
    expect(values).toEqual(['problem-id', 'organization-id', null, false]);
  });

  it('uses only global-scope placeholders and parameters for global test cases', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ test_case_revision: 2, id: null }],
        rowCount: 1,
      }),
    };
    const repository = new AdminRepository(database as never);

    await repository.listTestCases('global-problem-id');

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('p.organization_id IS NOT DISTINCT FROM $2::uuid');
    expect(sql).not.toContain('public.organization_members');
    expect(values).toEqual(['global-problem-id', null]);
    expectSqlPlaceholdersMatchValues(sql, values);
  });

  it('keeps Organization scope and manager authorization placeholders aligned', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ test_case_revision: 4, id: null }],
        rowCount: 1,
      }),
    };
    const repository = new AdminRepository(database as never);

    await repository.listTestCases('organization-problem-id', 'organization-id', {
      userId: 'owner-id',
      isSystemAdmin: false,
    });

    const [sql, values] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('p.organization_id IS NOT DISTINCT FROM $2::uuid');
    expect(sql).toContain('WHERE o.id = p.organization_id');
    expect(sql).toContain('$3::uuid');
    expect(sql).toContain('$4::boolean');
    expect(sql).toContain("om.role IN ('OWNER', 'ADMIN')");
    expect(values).toEqual(['organization-problem-id', 'organization-id', 'owner-id', false]);
    expectSqlPlaceholdersMatchValues(sql, values);
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
    expect(insert).toContain('score, scoring_enabled, status, illustration_url');
    expect(insert).toContain('illustration_alignment, created_by');
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

  it('persists illustration settings and retains them when older clients omit those fields', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT scoring_enabled, score::text')) {
          return {
            rows: [{
              scoring_enabled: false,
              score: '100',
              test_case_revision: 0,
              illustration_url: '/uploads/problem-illustrations/11111111-1111-4111-8111-111111111111.png',
              illustration_width: 60,
              illustration_aspect_ratio: '4:3',
              illustration_alignment: 'right',
            }],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({} as never);

    await repository.saveProblem({
      code: 'uth011', title: 'T', statement: 'S', difficulty: 'easy', tags: [], languages: [],
      timeLimitSeconds: 1, memoryLimitMb: 256, status: 'draft',
    } as never, 'user-1', 'p1');

    const update = client.query.mock.calls.find(([sql]) => String(sql).includes('illustration_url = $15'))!;
    expect(update[1]?.slice(14)).toEqual([
      '/uploads/problem-illustrations/11111111-1111-4111-8111-111111111111.png',
      60,
      '4:3',
      'right',
      null,
    ]);
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

  it('prevents changing test cases once an associated contest has started', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT test_case_revision, status')) {
          return { rows: [{ test_case_revision: 2, status: 'PUBLISHED' }], rowCount: 1 };
        }
        if (sql.includes('FROM public.contest_problems')) {
          return { rows: [{ contest_id: 'contest-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);

    await expect(repository.replaceTestCases('problem-1', 2, []))
      .rejects.toThrow(/sau khi cuộc thi bắt đầu/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE problem_test_cases SET position'),
      expect.anything(),
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('creates and updates editorial items atomically and preserves the submitted IDs', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT scoring_enabled, score::text')) {
          return { rows: [{ scoring_enabled: false, score: '100.00', test_case_revision: 0 }], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE problems')) return { rows: [{ id: 'p1' }], rowCount: 1 };
        if (sql.includes('UPDATE problem_editorials')) return { rows: [{ id: 'editorial-existing' }], rowCount: 1 };
        if (sql.includes('INSERT INTO problem_editorials')) return { rows: [{ id: 'editorial-new' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new AdminRepository({ connect: vi.fn().mockResolvedValue(client) } as never);
    vi.spyOn(repository, 'findProblem').mockResolvedValue({} as never);

    await repository.saveProblem({
      code: 'uth011',
      title: 'T',
      statement: 'S',
      difficulty: 'easy',
      tags: [],
      languages: [],
      timeLimitSeconds: 1,
      memoryLimitMb: 256,
      editorials: [
        { id: 'editorial-existing', title: 'Updated', language: 'C++17', sourceCode: 'int main() {}' },
        { title: 'Python', language: 'Python 3', sourceCode: 'print(1)' },
      ],
    } as never, 'admin-1', 'p1');

    const updateEditorial = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE problem_editorials'));
    expect(updateEditorial?.[1]).toEqual([
      'editorial-existing',
      'p1',
      'Updated',
      'C++17',
      'int main() {}',
      'admin-1',
    ]);
    const insertEditorial = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO problem_editorials'));
    expect(insertEditorial?.[1]).toEqual(['p1', 'admin-1', 'Python', 'Python 3', 'print(1)']);
    expect(client.query).toHaveBeenCalledWith(
      'DELETE FROM problem_editorials WHERE problem_id = $1 AND NOT (id = ANY($2::uuid[]))',
      ['p1', ['editorial-existing', 'editorial-new']],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});

function expectSqlPlaceholdersMatchValues(sql: string, values: unknown[]) {
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  const maxPlaceholder = Math.max(...placeholders);
  const uniquePlaceholders = [...new Set(placeholders)].sort((left, right) => left - right);

  expect(maxPlaceholder).toBe(values.length);
  expect(uniquePlaceholders).toEqual(
    Array.from({ length: values.length }, (_value, index) => index + 1),
  );
}
