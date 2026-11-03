import { describe, expect, it } from 'vitest';
import { rankLeaderboardCandidates, type LeaderboardCandidate } from './leaderboard-ranking.js';

function candidate(userId: string, patch: Partial<LeaderboardCandidate> = {}): LeaderboardCandidate {
  return {
    userId,
    username: userId,
    displayName: userId,
    avatarUrl: null,
    solvedCount: 0,
    cumulativePoints: 0,
    performancePercentile: null,
    comparableProblems: 0,
    achievementAt: null,
    createdAt: '2026-01-01T00:00:00.000000Z',
    ...patch,
  };
}

describe('leaderboard ranking', () => {
  it('orders by cumulative points before accepted problems', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('more-points', { solvedCount: 1, cumulativePoints: 100 }),
      candidate('more-solves', { solvedCount: 2, cumulativePoints: 1 }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['more-points', 'more-solves']);
  });

  it('orders equal points and accepted counts by account creation time, including zero scores', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('newest', { createdAt: '2026-01-03T00:00:00.000000Z' }),
      candidate('oldest', { createdAt: '2026-01-01T00:00:00.000000Z' }),
      candidate('middle', { createdAt: '2026-01-02T00:00:00.000000Z' }),
    ]);
    expect(ranked.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['oldest', 1],
      ['middle', 2],
      ['newest', 3],
    ]);
  });

  it('preserves timestamp ordering below JavaScript Date millisecond precision', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('later-microsecond', { createdAt: '2026-01-01T00:00:00.000002Z' }),
      candidate('earlier-microsecond', { createdAt: '2026-01-01T00:00:00.000001Z' }),
    ]);

    expect(ranked.map(({ userId }) => userId)).toEqual([
      'earlier-microsecond',
      'later-microsecond',
    ]);
  });

  it('uses the user ID when creation timestamps match and ignores performance and achievement ties', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('b', {
        cumulativePoints: 10,
        solvedCount: 1,
        performancePercentile: 0,
        achievementAt: '2026-01-01T00:00:00Z',
      }),
      candidate('a', {
        cumulativePoints: 10,
        solvedCount: 1,
        performancePercentile: 1,
        achievementAt: '2026-01-03T00:00:00Z',
      }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['a', 'b']);
  });

  it('assigns deterministic ranks to users with no accepted submissions', () => {
    const ranked = rankLeaderboardCandidates([candidate('b'), candidate('a')]);
    expect(ranked.map(({ userId, rank }) => [userId, rank])).toEqual([['a', 1], ['b', 2]]);
    expect(ranked[0]).not.toHaveProperty('createdAt');
  });
});