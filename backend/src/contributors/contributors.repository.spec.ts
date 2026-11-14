import { describe, expect, it, vi } from 'vitest';
import { ContributorsRepository } from './contributors.repository.js';

describe('ContributorsRepository', () => {
  it('counts unique published Global problems for active System Admin accounts only', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new ContributorsRepository({ query } as never).findCandidates();

    const sql = String(query.mock.calls[0][0]);
    expect(query).toHaveBeenCalledOnce();
    expect(sql).toContain('COUNT(DISTINCT p.id)');
    expect(sql).toContain('MAX(p.published_at)');
    expect(sql).toContain("p.status = 'PUBLISHED'");
    expect(sql).toContain('p.organization_id IS NULL');
    expect(sql).toContain("u.role = 'ADMIN'");
    expect(sql).toContain('u.is_active = TRUE');
    expect(sql).not.toContain('updated_at');
    expect(sql).not.toContain('email');
    expect(sql).not.toContain('password_hash');
  });

  it('preserves microsecond publication timestamps and handles NULL timestamps', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: 'admin-1',
          username: 'admin_one',
          display_name: 'Admin One',
          avatar_url: '/uploads/admin.webp',
          contribution_count: '3',
          latest_contribution_at: '2026-11-13T10:14:15.123456Z',
        },
        {
          user_id: 'admin-2',
          username: null,
          display_name: 'Người dùng UTH',
          avatar_url: null,
          contribution_count: 1,
          latest_contribution_at: null,
        },
      ],
    });

    const candidates = await new ContributorsRepository({
      query,
    } as never).findCandidates();

    expect(candidates).toEqual([
      {
        userId: 'admin-1',
        username: 'admin_one',
        displayName: 'Admin One',
        avatarUrl: '/uploads/admin.webp',
        contributionCount: 3,
        latestContributionAt: '2026-11-13T10:14:15.123456Z',
      },
      {
        userId: 'admin-2',
        username: null,
        displayName: 'Người dùng UTH',
        avatarUrl: null,
        contributionCount: 1,
        latestContributionAt: null,
      },
    ]);
  });
});
