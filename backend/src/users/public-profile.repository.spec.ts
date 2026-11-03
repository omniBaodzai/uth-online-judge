import { describe, expect, it, vi } from 'vitest';
import { PublicProfileRepository } from './public-profile.repository.js';

describe('PublicProfileRepository', () => {
  it('only selects active users and aggregates contribution counts in the profile query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PublicProfileRepository({ query } as never);

    await repository.findByUsername('coder');

    const [sql, parameters] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('u.is_active = TRUE');
    expect(sql).toContain('FROM public.discussions d WHERE d.author_id = u.id');
    expect(sql).toContain('FROM public.discussion_comments c WHERE c.author_id = u.id');
    expect(sql).not.toMatch(/u\.email|password_hash|refresh_token/i);
    expect(parameters).toEqual(['coder']);
  });

  it('groups TIMESTAMPTZ activity by Vietnam date and limits the window to the selected user', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PublicProfileRepository({ query } as never);

    await repository.listActivity('coder-id');

    const [sql, parameters] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("(s.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date");
    expect(sql).toContain("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today");
    expect(sql).toContain("(local_date.today - INTERVAL '370 days')");
    expect(sql).toContain('s.submitted_at < CURRENT_TIMESTAMP');
    expect(sql).not.toContain('CURRENT_DATE');
    expect(parameters).toEqual(['coder-id']);
  });

  it('returns date keys unchanged instead of converting them through the server timezone', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ date: '2026-11-04', count: '2' }],
    });
    const repository = new PublicProfileRepository({ query } as never);

    await expect(repository.listActivity('coder-id')).resolves.toEqual([
      { date: '2026-11-04', count: 2 },
    ]);
  });
});
