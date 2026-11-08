import { ConflictException } from '@nestjs/common';
import { OrganizationProblemGrantsRepository } from './organization-problem-grants.repository.js';

const grantRow = {
  id: 'grant-id',
  problem_id: 'problem-id',
  scope: 'GLOBAL_CONTESTS' as const,
  grantee_organization_id: null,
  grantee_slug: null,
  grantee_name: null,
  granted_by: 'manager-id',
  granted_at: new Date('2026-01-01T00:00:00Z'),
  revoked_by: null,
  revoked_at: null,
};

describe('OrganizationProblemGrantsRepository', () => {
  it('creates a GLOBAL_CONTESTS grant with JWT actor and ordered organization locks', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM public.organizations') && sql.includes('FOR SHARE')) {
          return {
            rows: [{ id: 'owner-org', status: 'ACTIVE' }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM public.organization_members')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
        if (sql.includes('FROM public.problems')) return { rows: [{ status: 'PUBLISHED' }], rowCount: 1 };
        if (sql.includes('INSERT INTO public.organization_problem_grants')) return { rows: [{ id: 'grant-id' }], rowCount: 1 };
        if (sql.includes('SELECT g.id')) return { rows: [grantRow], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new OrganizationProblemGrantsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.create(
      'problem-id',
      'owner-org',
      'GLOBAL_CONTESTS',
      null,
      { userId: 'manager-id', isSystemAdmin: false },
    )).resolves.toMatchObject({
      scope: 'GLOBAL_CONTESTS',
      grantedBy: 'manager-id',
      granteeOrganization: null,
    });

    const sqls = client.query.mock.calls.map(([sql]) => String(sql));
    const lockIndex = sqls.findIndex((sql) => sql.includes('FROM public.organizations') && sql.includes('FOR SHARE'));
    const memberIndex = sqls.findIndex((sql) => sql.includes('FROM public.organization_members'));
    const problemIndex = sqls.findIndex((sql) => sql.includes('FROM public.problems'));
    const insertIndex = sqls.findIndex((sql) => sql.includes('INSERT INTO public.organization_problem_grants'));
    expect(lockIndex).toBeLessThan(memberIndex);
    expect(memberIndex).toBeLessThan(problemIndex);
    expect(problemIndex).toBeLessThan(insertIndex);
    expect(client.query.mock.calls[insertIndex]?.[1]).toEqual([
      'problem-id',
      'GLOBAL_CONTESTS',
      null,
      'manager-id',
    ]);
    expect(sqls.at(-1)).toBe('COMMIT');
  });

  it('records the revoking actor and preserves the grant as history', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT status FROM public.organizations')) return { rows: [{ status: 'ACTIVE' }], rowCount: 1 };
        if (sql.includes('FROM public.organization_members')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
        if (sql.includes('SELECT g.revoked_at')) return { rows: [{ revoked_at: null }], rowCount: 1 };
        if (sql.includes('UPDATE public.organization_problem_grants')) return { rows: [], rowCount: 1 };
        if (sql.includes('SELECT g.id')) return {
          rows: [{ ...grantRow, revoked_by: 'manager-id', revoked_at: new Date('2026-02-01T00:00:00Z') }],
          rowCount: 1,
        };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = new OrganizationProblemGrantsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    const result = await repository.revoke(
      'problem-id',
      'grant-id',
      'owner-org',
      { userId: 'manager-id', isSystemAdmin: false },
    );

    expect(result).toMatchObject({ revokedBy: 'manager-id', revokedAt: '2026-02-01T00:00:00.000Z' });
    const update = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE public.organization_problem_grants'));
    expect(update?.[1]).toEqual(['grant-id', 'manager-id']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rejects grants for archived organizations before insertion', async () => {
    const client = {
      query: vi.fn(async (sql: string) => (
        sql.includes('FROM public.organizations') && sql.includes('FOR SHARE')
          ? { rows: [{ id: 'owner-org', status: 'ARCHIVED' }], rowCount: 1 }
          : { rows: [], rowCount: 1 }
      )),
      release: vi.fn(),
    };
    const repository = new OrganizationProblemGrantsRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.create(
      'problem-id',
      'owner-org',
      'GLOBAL_CONTESTS',
      null,
      { userId: 'admin-id', isSystemAdmin: true },
    )).rejects.toBeInstanceOf(ConflictException);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.organization_problem_grants'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
