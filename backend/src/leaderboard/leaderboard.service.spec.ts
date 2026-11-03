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
  createdAt: '2026-01-01T00:00:00.000000Z',
  ...patch,
});

function build(candidates: LeaderboardCandidate[]) {
  const repository = { findCandidates: vi.fn().mockResolvedValue(candidates) };
  return { repository, service: new LeaderboardService(repository as never) };
}

describe('LeaderboardService', () => {
  it('searches and paginates without changing global ranks or the viewer rank', async () => {
    const { service, repository } = build([
      candidate('u2', {
        username: 'lebao',
        displayName: 'Bảo',
        solvedCount: 2,
        createdAt: '2026-01-03T00:00:00.000000Z',
      }),
      candidate('u1', {
        username: 'leuser',
        displayName: 'An',
        solvedCount: 1,
        createdAt: '2026-01-01T00:00:00.000000Z',
      }),
      candidate('u3', {
        username: 'other',
        displayName: 'Lê Minh',
        solvedCount: 1,
        createdAt: '2026-01-02T00:00:00.000000Z',
      }),
    ]);
    const result = await service.getLeaderboard({ page: 2, pageSize: 1, q: '  LE ' }, 'u1');

    expect(result.items.map(({ userId, rank }) => [userId, rank])).toEqual([['u1', 2]]);
    expect(result.total).toBe(2);
    expect(result.totalUsers).toBe(3);
    expect(result.viewerRank).toBe(2);
    expect(result.items[0]).not.toHaveProperty('createdAt');
    expect(repository.findCandidates).toHaveBeenCalledOnce();
  });

  it('uses the same global ordering for pagination, username search, and personal rank', async () => {
    const { service } = build([
      candidate('newest-zero', {
        username: 'newest',
        createdAt: '2026-01-03T00:00:00.000000Z',
      }),
      candidate('older-zero', {
        username: 'older',
        createdAt: '2026-01-01T00:00:00.000000Z',
      }),
      candidate('points-first', {
        username: 'points',
        cumulativePoints: 5,
        solvedCount: 1,
      }),
    ]);

    const secondPage = await service.getLeaderboard({ page: 2, pageSize: 1 }, 'newest-zero');
    const search = await service.getLeaderboard({ page: 1, pageSize: 10, q: 'newest' }, null);
    const personalRank = await service.findRankedUser('newest-zero');

    expect(secondPage.items.map(({ userId, rank }) => [userId, rank])).toEqual([['older-zero', 2]]);
    expect(secondPage.viewerRank).toBe(3);
    expect(search.items.map(({ userId, rank }) => [userId, rank])).toEqual([['newest-zero', 3]]);
    expect(personalRank?.rank).toBe(3);
    expect(personalRank).not.toHaveProperty('createdAt');
  });

  it('returns a stable empty result for a leaderboard without users', async () => {
    const { service } = build([]);
    await expect(service.getLeaderboard({ page: 1, pageSize: 20 }, null)).resolves.toMatchObject({
      items: [], total: 0, viewerRank: null,
    });
  });
});