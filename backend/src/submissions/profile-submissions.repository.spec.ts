import { describe, expect, it, vi } from 'vitest';
import { SubmissionsRepository } from './submissions.repository.js';

describe('profile submission filtering', () => {
  it('filters listed submissions and all related aggregates by exact user ID', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ items: [], total: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new SubmissionsRepository({ query } as never);
    const userId = 'cbe7201d-02e4-4a60-a3ce-2313178b43df';

    await repository.findGlobalSubmissions(null, {
      page: 1,
      pageSize: 10,
      userId,
    });

    expect(query.mock.calls[0]?.[0]).toContain('($8::uuid IS NULL OR s.user_id = $8)');
    expect(query.mock.calls[0]?.[1]).toEqual([null, null, null, 10, 0, null, null, userId]);
    expect(query.mock.calls[1]?.[0]).toContain('s.user_id = $2');
    expect(query.mock.calls[1]?.[1]).toEqual([null, userId]);
    expect(query.mock.calls[2]?.[0]).toContain('s.user_id = $2');
    expect(query.mock.calls[2]?.[1]).toEqual([null, userId]);
  });
});
