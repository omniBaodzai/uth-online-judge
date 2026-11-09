import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationSubmissionsRepository } from './organization-submissions.repository.js';

function createPool(query: (sql: string, values?: unknown[]) => unknown) {
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => query(sql, values)),
    release: vi.fn(),
  };
  return {
    client,
    pool: {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn(async (sql: string, values?: unknown[]) => query(sql, values)),
    } as never,
  };
}

function standalonePool(options: {
  organizationStatus?: string;
  problemsVisibility?: 'PUBLIC' | 'PRIVATE';
  member?: boolean;
  published?: boolean;
} = {}) {
  const {
    organizationStatus = 'ACTIVE',
    problemsVisibility = 'PUBLIC',
    member = false,
    published = true,
  } = options;
  return createPool((sql) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes('FROM public.organizations') && sql.includes('WHERE slug')) {
      return {
        rows: [{
          id: 'organization-id',
          status: organizationStatus,
          contests_visibility: 'PUBLIC',
          problems_visibility: problemsVisibility,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM public.organization_members')) {
      return { rows: member ? [{ role: 'MEMBER' }] : [], rowCount: member ? 1 : 0 };
    }
    if (sql.includes('FROM public.problems') && sql.includes('problem_code')) {
      return { rows: published ? [{ id: 'problem-id' }] : [], rowCount: published ? 1 : 0 };
    }
    if (sql.includes('FROM public.programming_languages')) {
      return { rows: [{ id: 'language-id' }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO public.submissions')) {
      return {
        rows: [{
          id: 'submission-id',
          status: 'PENDING',
          submitted_at: new Date('2026-01-01T00:00:00Z'),
        }],
        rowCount: 1,
      };
    }
    if (sql.includes('INSERT INTO public.submission_test_case_snapshots')) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
}

describe('OrganizationSubmissionsRepository', () => {
  it('lists standalone languages for active published problems visible to the viewer', async () => {
    const { pool } = createPool(() => ({
      rows: [{ slug: 'cpp', name: 'C++' }],
      rowCount: 1,
    }));
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.listStandaloneLanguages(
      'uth-cs',
      'problem-id',
      { userId: 'member-id', isSystemAdmin: false },
    )).resolves.toEqual([{ slug: 'cpp', name: 'C++' }]);

    const [sql, values] = (pool as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization.status = 'ACTIVE'");
    expect(sql).toContain("organization.problems_visibility = 'PUBLIC'");
    expect(sql).toContain("problem.status = 'PUBLISHED'");
    expect(sql).toContain('FROM public.organization_members member');
    expect(values).toEqual(['uth-cs', 'problem-id', false, 'member-id']);
  });

  it('lists contest languages only for registered participants while content access remains valid', async () => {
    const { pool } = createPool(() => ({
      rows: [{ slug: 'cpp', name: 'C++' }],
      rowCount: 1,
    }));
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.listContestLanguages(
      'uth-cs',
      'contest-id',
      'problem-id',
      { userId: 'user-id', isSystemAdmin: false },
    )).resolves.toEqual([{ slug: 'cpp', name: 'C++' }]);

    const [sql, values] = (pool as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("contest.publication_status = 'PUBLISHED'");
    expect(sql).toContain('public.contest_problem_content_accessible(contest.id, problem.id)');
    expect(sql).toContain("participant.registration_status = 'REGISTERED'");
    expect(sql).toContain("source_organization.status = 'ACTIVE'");
    expect(values).toEqual(['uth-cs', 'contest-id', 'problem-id', false, 'user-id']);
  });

  it('allows a non-member to submit to a published problem in an active PUBLIC organization', async () => {
    const { client, pool } = standalonePool();
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertStandalone(
      'uth-cs',
      { userId: 'outsider-id', isSystemAdmin: false },
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'int main() {}' },
    )).resolves.toMatchObject({ id: 'submission-id', status: 'PENDING' });

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    const organizationLock = sqls.findIndex((sql) => sql.includes('FROM public.organizations') && sql.includes('FOR SHARE'));
    const membershipCheck = sqls.findIndex((sql) => sql.includes('FROM public.organization_members'));
    const problemLock = sqls.findIndex((sql) => sql.includes('FROM public.problems') && sql.includes('FOR SHARE'));
    const insert = sqls.findIndex((sql) => sql.includes('INSERT INTO public.submissions'));
    expect(organizationLock).toBeLessThan(membershipCheck);
    expect(membershipCheck).toBeLessThan(problemLock);
    expect(problemLock).toBeLessThan(insert);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects a non-member submitting to a PRIVATE organization', async () => {
    const { client, pool } = standalonePool({ problemsVisibility: 'PRIVATE' });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertStandalone(
      'uth-cs',
      { userId: 'outsider-id', isSystemAdmin: false },
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'code' },
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('FROM public.problems'))).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.submissions'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('allows a current member to submit to a PRIVATE organization', async () => {
    const { pool } = standalonePool({ problemsVisibility: 'PRIVATE', member: true });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertStandalone(
      'uth-cs',
      { userId: 'member-id', isSystemAdmin: false },
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'code' },
    )).resolves.toMatchObject({ id: 'submission-id', status: 'PENDING' });
  });

  it('rejects new standalone submissions for archived organizations, including System Admin', async () => {
    const { client, pool } = standalonePool({
      organizationStatus: 'ARCHIVED',
      problemsVisibility: 'PRIVATE',
    });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertStandalone(
      'uth-cs',
      { userId: 'admin-id', isSystemAdmin: true },
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'code' },
    )).rejects.toBeInstanceOf(ConflictException);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.submissions'))).toBe(false);
  });

  it('rejects submissions for unpublished problems', async () => {
    const { client, pool } = standalonePool({ published: false });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertStandalone(
      'uth-cs',
      { userId: 'outsider-id', isSystemAdmin: false },
      { problemCode: 'UTH001', language: 'cpp', sourceCode: 'code' },
    )).rejects.toBeInstanceOf(NotFoundException);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.submissions'))).toBe(false);
  });

  it('takes organization locks before contest/grant use and requires an active grant and registration', async () => {
    const { client, pool } = createPool((sql) => {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT organization.id AS organization_id')) {
        return {
          rows: [{
            organization_id: 'target-org',
            problem_organization_id: 'source-org',
            problem_id: 'problem-id',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('WHERE id = ANY')) {
        return { rows: [{ id: 'source-org' }, { id: 'target-org' }], rowCount: 2 };
      }
      if (sql.includes('FROM public.organizations') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: 'target-org', status: 'ACTIVE', contests_visibility: 'PUBLIC' }], rowCount: 1 };
      }
      if (sql.includes('FROM public.organization_members')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM public.contests') && sql.includes('FOR SHARE')) {
        return { rows: [{ id: 'contest-id', visibility: 'PUBLIC', publication_status: 'PUBLISHED', is_ongoing: true }], rowCount: 1 };
      }
      if (sql.includes('FROM public.contest_participants')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM public.organization_problem_grants')) return { rows: [{ id: 'grant-id' }], rowCount: 1 };
      if (sql.startsWith('SELECT public.contest_problem_content_accessible')) {
        return { rows: [{ accessible: true }], rowCount: 1 };
      }
      if (sql.includes('FROM public.problems') && sql.includes('FOR SHARE')) {
        return { rows: [{ id: 'problem-id', organization_id: 'source-org' }], rowCount: 1 };
      }
      if (sql.includes('FROM public.programming_languages')) return { rows: [{ id: 'language-id' }], rowCount: 1 };
      if (sql.includes('INSERT INTO public.submissions')) {
        return { rows: [{ id: 'submission-id', status: 'PENDING', submitted_at: new Date('2026-01-01T00:00:00Z') }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO public.submission_test_case_snapshots')) return { rows: [], rowCount: 1 };
      if (sql.includes('FROM public.organizations') && sql.includes('WHERE id = $1')) {
        return { rows: [{ id: 'source-org', status: 'ACTIVE', contests_visibility: 'PUBLIC' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertContest(
      'target',
      'contest-id',
      { userId: 'member-id', isSystemAdmin: false },
      { problemCode: 'SHARED1', language: 'cpp', sourceCode: 'code' },
    )).resolves.toMatchObject({ id: 'submission-id' });

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    const orgLock = sqls.findIndex((sql) => sql.includes('WHERE id = ANY'));
    const grantLock = sqls.findIndex((sql) => sql.includes('FROM public.organization_problem_grants'));
    const contestLock = sqls.findIndex((sql) => sql.includes('FROM public.contests') && sql.includes('FOR SHARE'));
    expect(orgLock).toBeLessThan(grantLock);
    expect(grantLock).toBeLessThan(contestLock);
    expect(sqls.some((sql) => sql.includes('public.contest_problem_content_accessible'))).toBe(true);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('does not let standalone PUBLIC-problem access bypass contest registration', async () => {
    const { client, pool } = createPool((sql) => {
      if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT organization.id AS organization_id')) {
        return {
          rows: [{
            organization_id: 'target-org',
            problem_organization_id: null,
            problem_id: 'global-problem-id',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('WHERE id = ANY')) {
        return { rows: [{ id: 'target-org' }], rowCount: 1 };
      }
      if (sql.includes('FROM public.organizations') && sql.includes('WHERE id = $1')) {
        return {
          rows: [{ id: 'target-org', status: 'ACTIVE', contests_visibility: 'PUBLIC' }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM public.organization_members')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM public.contests') && sql.includes('FOR SHARE')) {
        return {
          rows: [{
            id: 'contest-id',
            visibility: 'PUBLIC',
            publication_status: 'PUBLISHED',
            is_ongoing: true,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM public.contest_participants')) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const repository = new OrganizationSubmissionsRepository(pool);

    await expect(repository.insertContest(
      'target',
      'contest-id',
      { userId: 'non-member-id', isSystemAdmin: false },
      { problemCode: 'GLOBAL1', language: 'cpp', sourceCode: 'code' },
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.submissions'))).toBe(false);
  });

  it('returns personal history without problem title, problem code, or username fields', async () => {
    const { pool } = createPool((sql) => {
      if (sql.includes('FROM public.organizations') && sql.includes('WHERE slug')) {
        return { rows: [{ id: 'organization-id' }], rowCount: 1 };
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 };
      return {
        rows: [{
          id: 'submission-id',
          status: 'ACCEPTED',
          submitted_at: new Date('2026-01-01T00:00:00Z'),
          language: 'C++',
          execution_time_ms: 10,
          memory_used_kb: 1024,
          score: '1',
          max_score: '1',
          contest_id: null,
        }],
        rowCount: 1,
      };
    });
    const repository = new OrganizationSubmissionsRepository(pool);

    const page = await repository.findOwnHistory('uth-cs', 'former-member', {
      page: 1,
      pageSize: 10,
    });

    expect(page.items[0]).toMatchObject({ id: 'submission-id', status: 'ACCEPTED' });
    expect(page.items[0]).toMatchObject({
      problemCode: null,
      problemTitle: null,
      username: null,
    });
  });
});
