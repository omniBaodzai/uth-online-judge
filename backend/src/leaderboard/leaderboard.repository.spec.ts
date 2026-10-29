import { describe, expect, it, vi } from 'vitest';
import { LeaderboardRepository } from './leaderboard.repository.js';

describe('LeaderboardRepository', () => {
  it('uses current test fingerprints and complete accepted snapshots, without contest tables', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new LeaderboardRepository({ query } as never).findCandidates();
    const sql = String(query.mock.calls[0][0]);

    expect(sql).toMatch(/student_test_case_progress/);
    expect(sql).toMatch(/active\.content_fingerprint = passed\.content_fingerprint/);
    expect(sql).toMatch(/valid_accepted_submissions/);
    expect(sql).toMatch(/COUNT\(DISTINCT snapshot\.id\) = COUNT\(DISTINCT result\.id\)/);
    expect(sql).toMatch(/result\.status = 'ACCEPTED'/);
    expect(sql).toMatch(/snapshot\.time_limit_ms/);
    expect(sql).toMatch(/language\.judge0_language_id/);
    expect(sql).not.toMatch(/contest_standings|contest_submissions/i);
    expect(sql).not.toMatch(/WHERE u\.is_active|u\.role/);
  });

  it('maps database aggregates without leaking internal performance fields', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        user_id: 'u1', username: null, display_name: 'Member', avatar_url: null,
        solved_count: 2, cumulative_points: 17, performance_percentile: '0.25',
        comparable_problems: 3, achievement_at: new Date('2026-01-01T00:00:00Z'),
      }],
    });
    const rows = await new LeaderboardRepository({ query } as never).findCandidates();
    expect(rows[0]).toEqual({
      userId: 'u1', username: null, displayName: 'Member', avatarUrl: null,
      solvedCount: 2, cumulativePoints: 17, performancePercentile: 0.25,
      comparableProblems: 3, achievementAt: '2026-01-01T00:00:00.000Z',
    });
  });
});