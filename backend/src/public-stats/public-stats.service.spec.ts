import { PublicStatsService } from './public-stats.service.js';

describe('PublicStatsService', () => {
  it('counts active users, published problems, and all submission statuses', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ members: '3', problems: '2', submissions: '7' }],
    });
    const service = new PublicStatsService({ query } as never);

    await expect(service.getStats()).resolves.toEqual({
      members: 3,
      problems: 2,
      submissions: 7,
    });

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('FROM users WHERE is_active = TRUE');
    expect(sql).toContain("FROM problems WHERE status = 'PUBLISHED'");
    expect(sql).toContain('FROM submissions');
    expect(sql).not.toMatch(/FROM submissions\s+WHERE/i);
  });

  it('returns zero for empty tables', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ members: '0', problems: '0', submissions: '0' }],
    });
    const service = new PublicStatsService({ query } as never);

    await expect(service.getStats()).resolves.toEqual({
      members: 0,
      problems: 0,
      submissions: 0,
    });
  });

  it('surfaces database errors instead of returning fallback data', async () => {
    const error = new Error('database unavailable');
    const service = new PublicStatsService({
      query: vi.fn().mockRejectedValue(error),
    } as never);

    await expect(service.getStats()).rejects.toBe(error);
  });
});
