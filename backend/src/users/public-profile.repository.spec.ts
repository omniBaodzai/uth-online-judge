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

  it('limits activity to the heatmap window and the selected coder', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PublicProfileRepository({ query } as never);

    await repository.listActivity('coder-id');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("submitted_at >= CURRENT_DATE - INTERVAL '370 days'"),
      ['coder-id'],
    );
  });
});
