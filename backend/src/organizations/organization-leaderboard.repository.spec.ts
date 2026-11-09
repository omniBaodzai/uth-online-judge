import { describe, expect, it, vi } from 'vitest';
import { OrganizationLeaderboardRepository } from './organization-leaderboard.repository.js';

async function leaderboardSql() {
  const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
  await new OrganizationLeaderboardRepository(pool as never).findLeaderboard('org-id', {
    page: 1,
    pageSize: 20,
  });
  return String(pool.query.mock.calls[0]?.[0]);
}

describe('OrganizationLeaderboardRepository', () => {
  it('ranks only current membership rows across roles, including zero solves and stable ties', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { rank: 1, user_id: 'u1', username: 'alpha', solved_count: 2, total: 3 },
          { rank: 2, user_id: 'u2', username: 'beta', solved_count: 0, total: 3 },
          { rank: 3, user_id: 'u3', username: null, solved_count: 0, total: 3 },
        ],
      }),
    };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    const page = await repository.findLeaderboard('org-id', { page: 1, pageSize: 3 });
    const sql = pool.query.mock.calls[0]?.[0] as string;

    expect(page).toEqual({
      items: [
        { rank: 1, userId: 'u1', username: 'alpha', solvedCount: 2 },
        { rank: 2, userId: 'u2', username: 'beta', solvedCount: 0 },
        { rank: 3, userId: 'u3', username: null, solvedCount: 0 },
      ],
      total: 3,
      page: 1,
      pageSize: 3,
    });
    expect(sql).toContain('FROM public.organization_members membership');
    expect(sql).toContain('WHERE membership.organization_id = $1');
    expect(sql).toContain('LEFT JOIN solved_counts');
    expect(sql).toContain('COALESCE(solved_counts.solved_count, 0)');
    expect(sql).toContain('ORDER BY COALESCE(solved_counts.solved_count, 0) DESC');
    expect(sql).toContain('account.username ASC');
    expect(sql).toContain('account.id ASC');
    expect(sql).not.toContain('role');
    expect(sql).not.toContain('source_code');
    expect(sql).not.toContain('problem.title');
    expect(sql).not.toContain('problem.statement');
  });

  it('counts distinct problems from published standalone submissions and ended organization contests only', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ rank: 1, user_id: 'u1', username: 'alpha', solved_count: 1, total: 1 }],
      }),
    };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    await repository.findLeaderboard('org-id', { page: 1, pageSize: 20 });
    const sql = pool.query.mock.calls[0]?.[0] as string;

    expect(sql).toContain("problem.status = 'PUBLISHED'");
    expect(sql).toContain('(s.contest_id IS NULL AND problem.organization_id = $1)');
    expect(sql).toContain('contest.organization_id = $1');
    expect(sql).toContain('contest.ends_at <= CURRENT_TIMESTAMP');
    expect(sql).toContain('COUNT(DISTINCT problem_id)::int AS solved_count');
    expect(sql).not.toContain('problem.organization_id = $1\n                AND s.contest_id IS NOT NULL');
    expect(sql).not.toContain('contest.organization_id IS NULL');
    expect(sql).not.toContain('contest.organization_id = $1 OR');
  });

  it('requires a judged ACCEPTED submission with a complete all-accepted snapshot result set', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    await repository.findLeaderboard('org-id', { page: 1, pageSize: 20 });
    const sql = pool.query.mock.calls[0]?.[0] as string;

    expect(sql).toContain("s.status = 'ACCEPTED'");
    expect(sql).toContain('s.judged_at IS NOT NULL');
    expect(sql).toContain('COUNT(DISTINCT snapshot.id) > 0');
    expect(sql).toContain('COUNT(DISTINCT snapshot.id) = COUNT(DISTINCT test_result.id)');
    expect(sql).toContain('FILTER (WHERE test_result.status = \'ACCEPTED\')');
    expect(sql).toContain('test_result.snapshot_id = snapshot.id');
  });

  it('returns items empty and total zero for an Organization with no current members', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ rank: null, user_id: null, username: null, solved_count: null, total: 0 }],
      }),
    };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    await expect(repository.findLeaderboard('empty-org', { page: 1, pageSize: 20 })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(pool.query.mock.calls[0]?.[0]).toContain('FROM public.organization_members membership');
    expect(pool.query.mock.calls[0]?.[0]).toContain('WHERE membership.organization_id = $1');
  });

  it('returns solvedCount 1 for one member with one valid ACCEPTED problem', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ rank: 1, user_id: 'member-id', username: 'member', solved_count: 1, total: 1 }],
      }),
    };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    await expect(repository.findLeaderboard('org-id', { page: 1, pageSize: 20 })).resolves.toEqual({
      items: [{ rank: 1, userId: 'member-id', username: 'member', solvedCount: 1 }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const sql = String(pool.query.mock.calls[0]?.[0]);
    expect(sql).toContain("s.status = 'ACCEPTED'");
    expect(sql).toContain('COUNT(DISTINCT problem_id)::int AS solved_count');
  });

  it('returns an empty page with the full member total when pagination has no rows', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ rank: null, user_id: null, username: null, solved_count: null, total: 4 }],
      }),
    };
    const repository = new OrganizationLeaderboardRepository(pool as never);

    await expect(repository.findLeaderboard('org-id', { page: 3, pageSize: 2 })).resolves.toEqual({
      items: [],
      total: 4,
      page: 3,
      pageSize: 2,
    });
    expect(pool.query.mock.calls[0]?.[1]).toEqual(['org-id', 2, 4]);
  });

  it('uses the current membership table so leaving removes a rank and rejoining restores eligibility', async () => {
    const sql = await leaderboardSql();
    const normalized = sql.replace(/\s+/g, ' ');

    expect(normalized).toContain('FROM public.organization_members membership');
    expect(normalized).toContain('JOIN public.users account ON account.id = membership.user_id');
    expect(normalized).toContain('WHERE membership.organization_id = $1');
    expect(normalized).not.toMatch(/membership_history|membership_events|joined_at|left_at/i);
  });

  it('includes current OWNER and ADMIN members but excludes nonmembers regardless of system role', async () => {
    const sql = await leaderboardSql();

    expect(sql).toContain('FROM public.organization_members membership');
    expect(sql).toContain('WHERE membership.organization_id = $1');
    expect(sql).not.toContain('membership.role');
    expect(sql).not.toContain('account.role');
    expect(sql).not.toContain('is_system_admin');
  });

  it('counts private-visibility Organization problems while selecting no private problem or source details', async () => {
    const sql = await leaderboardSql();

    expect(sql).toContain('(s.contest_id IS NULL AND problem.organization_id = $1)');
    expect(sql).toContain("problem.status = 'PUBLISHED'");
    expect(sql).not.toContain('problems_visibility');
    expect(sql).not.toContain('problem.title');
    expect(sql).not.toContain('problem.statement');
    expect(sql).not.toContain('source_code');
    expect(sql).not.toContain('expected_output');
  });

  it('rejects running Organization contests and admits ended Organization contests at the end-time boundary', async () => {
    const normalized = (await leaderboardSql()).replace(/\s+/g, ' ');
    const scope = normalized.slice(normalized.indexOf('AND ('), normalized.indexOf('GROUP BY'));

    expect(scope).toContain('contest.organization_id = $1');
    expect(scope).toContain('contest.ends_at <= CURRENT_TIMESTAMP');
    expect(scope).not.toContain('contest.ends_at > CURRENT_TIMESTAMP');
  });

  it('excludes Global contests using Organization problems and Global standalone problems', async () => {
    const normalized = (await leaderboardSql()).replace(/\s+/g, ' ');
    const scope = normalized.slice(normalized.indexOf('AND ('), normalized.indexOf('GROUP BY'));
    const contestBranchStart = scope.indexOf('OR (') + 'OR ('.length;
    const contestBranch = scope.slice(contestBranchStart, scope.lastIndexOf(')'));

    expect(scope).toContain('(s.contest_id IS NULL AND problem.organization_id = $1)');
    expect(contestBranch).toContain('s.contest_id IS NOT NULL');
    expect(contestBranch).toContain('contest.organization_id = $1');
    expect(contestBranch).not.toContain('problem.organization_id');
    expect(scope).not.toContain('contest.organization_id IS NULL');
  });

  it('excludes submissions from other Organizations in both standalone and contest scopes', async () => {
    const normalized = (await leaderboardSql()).replace(/\s+/g, ' ');
    const scope = normalized.slice(normalized.indexOf('AND ('), normalized.indexOf('GROUP BY'));

    expect(scope).toContain('problem.organization_id = $1');
    expect(scope).toContain('contest.organization_id = $1');
    expect(scope).not.toContain('problem.organization_id <>');
    expect(scope).not.toContain('contest.organization_id <>');
  });

  it('assigns deterministic username/userId ties before paginating by stable global rank', async () => {
    const normalized = (await leaderboardSql()).replace(/\s+/g, ' ');

    expect(normalized).toContain(
      'ORDER BY COALESCE(solved_counts.solved_count, 0) DESC, account.username ASC, account.id ASC',
    );
    expect(normalized).toContain('FROM ranked_members ORDER BY rank LIMIT $2 OFFSET $3');
    expect(normalized).toContain('ROW_NUMBER() OVER');
  });
});
