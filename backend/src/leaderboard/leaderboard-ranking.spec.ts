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
    ...patch,
  };
}

describe('leaderboard ranking', () => {
  it('orders by unique accepted problems before cumulative points', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('more-points', { solvedCount: 1, cumulativePoints: 100 }),
      candidate('more-solves', { solvedCount: 2, cumulativePoints: 1 }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['more-solves', 'more-points']);
  });

  it('uses normalized comparable performance only after solved count and points', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('slower', { solvedCount: 3, cumulativePoints: 20, performancePercentile: 0.8 }),
      candidate('faster', { solvedCount: 3, cumulativePoints: 20, performancePercentile: 0.2 }),
      candidate('more-points', { solvedCount: 3, cumulativePoints: 21, performancePercentile: 1 }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['more-points', 'faster', 'slower']);
  });

  it('treats missing comparable performance as neutral and prefers the earlier achievement', () => {
    const ranked = rankLeaderboardCandidates([
      candidate('unknown', { solvedCount: 1, cumulativePoints: 10, achievementAt: '2026-01-03T00:00:00Z' }),
      candidate('known-average', { solvedCount: 1, cumulativePoints: 10, performancePercentile: 0.5, achievementAt: '2026-01-02T00:00:00Z' }),
      candidate('known-fast', { solvedCount: 1, cumulativePoints: 10, performancePercentile: 0.1, achievementAt: '2026-01-04T00:00:00Z' }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['known-fast', 'known-average', 'unknown']);
  });

  it('uses user ID for a stable order when achievements and metrics tie', () => {
    const achievementAt = '2026-01-01T00:00:00Z';
    const ranked = rankLeaderboardCandidates([
      candidate('b', { solvedCount: 1, cumulativePoints: 4, achievementAt }),
      candidate('a', { solvedCount: 1, cumulativePoints: 4, achievementAt }),
    ]);
    expect(ranked.map(({ userId }) => userId)).toEqual(['a', 'b']);
  });

  it('assigns deterministic ranks to users with no accepted submissions', () => {
    const ranked = rankLeaderboardCandidates([candidate('b'), candidate('a')]);
    expect(ranked.map(({ userId, rank }) => [userId, rank])).toEqual([['a', 1], ['b', 2]]);
  });
});