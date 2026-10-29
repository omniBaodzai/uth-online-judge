import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from './leaderboard.service.js';
import type { LeaderboardCandidate } from './leaderboard-ranking.js';

const candidate = (userId: string, patch: Partial<LeaderboardCandidate> = {}): LeaderboardCandidate => ({
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
});

function build(candidates: LeaderboardCandidate[]) {
  const repository = { findCandidates: vi.fn().mockResolvedValue(candidates) };
  return { repository, service: new LeaderboardService(repository as never) };
}

describe('LeaderboardService', () => {
  it('searches and paginates without changing global ranks or the viewer rank', async () => {
    const { service, repository } = build([
      candidate('u2', { username: 'lebao', displayName: 'Bảo', solvedCount: 2 }),
      candidate('u1', { username: 'leuser', displayName: 'An', solvedCount: 1 }),
      candidate('u3', { username: 'other', displayName: 'Lê Minh', solvedCount: 1 }),
    ]);
    const result = await service.getLeaderboard({ page: 1, pageSize: 1, q: '  LE ' }, 'u1');

    expect(result.items.map(({ userId, rank }) => [userId, rank])).toEqual([['u2', 1]]);
    expect(result.total).toBe(2);
    expect(result.totalUsers).toBe(3);
    expect(result.viewerRank).toBe(2);
    expect(repository.findCandidates).toHaveBeenCalledOnce();
  });

  it('returns a stable empty result for a leaderboard without users', async () => {
    const { service } = build([]);
    await expect(service.getLeaderboard({ page: 1, pageSize: 20 }, null)).resolves.toMatchObject({
      items: [], total: 0, viewerRank: null,
    });
  });
});