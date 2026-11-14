import { describe, expect, it, vi } from 'vitest';
import { ContributorsService } from './contributors.service.js';
import type { ContributorCandidate } from './contributors.types.js';

const candidate = (
  userId: string,
  patch: Partial<ContributorCandidate> = {},
): ContributorCandidate => ({
  userId,
  username: userId,
  displayName: userId,
  avatarUrl: null,
  contributionCount: 0,
  latestContributionAt: null,
  ...patch,
});

function build(candidates: ContributorCandidate[]) {
  const repository = { findCandidates: vi.fn().mockResolvedValue(candidates) };
  return { repository, service: new ContributorsService(repository as never) };
}

describe('ContributorsService', () => {
  it('ranks higher problem counts first, then latest publication time', async () => {
    const { service } = build([
      candidate('admin-b', {
        contributionCount: 2,
        latestContributionAt: '2026-11-13T12:00:00.000000Z',
      }),
      candidate('admin-a', {
        contributionCount: 3,
        latestContributionAt: '2026-11-10T12:00:00.000000Z',
      }),
      candidate('admin-c', {
        contributionCount: 2,
        latestContributionAt: '2026-11-12T12:00:00.000000Z',
      }),
    ]);

    const page = await service.getContributors({ page: 1, pageSize: 10 });
    expect(page.items.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['admin-a', 1],
      ['admin-b', 2],
      ['admin-c', 3],
    ]);
  });

  it('uses user ID for exact ties and places NULL publication times last', async () => {
    const { service } = build([
      candidate('admin-z', {
        contributionCount: 2,
        latestContributionAt: '2026-11-12T12:00:00.000000Z',
      }),
      candidate('admin-null', {
        contributionCount: 1,
        latestContributionAt: null,
      }),
      candidate('admin-b', {
        contributionCount: 2,
        latestContributionAt: '2026-11-12T12:00:00.000000Z',
      }),
    ]);

    const page = await service.getContributors({ page: 1, pageSize: 10 });
    expect(page.items.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['admin-b', 1],
      ['admin-z', 2],
      ['admin-null', 3],
    ]);
  });

  it('searches after ranking and preserves global ranks across pagination', async () => {
    const { service, repository } = build([
      candidate('admin-c', { username: 'third_admin', contributionCount: 1 }),
      candidate('admin-a', { username: 'first_admin', contributionCount: 3 }),
      candidate('admin-b', { username: 'second_admin', contributionCount: 2 }),
    ]);

    const page = await service.getContributors({
      page: 1,
      pageSize: 1,
      q: ' SECOND ',
    });
    expect(page.items.map(({ userId, rank }) => [userId, rank])).toEqual([
      ['admin-b', 2],
    ]);
    expect(page).toMatchObject({
      total: 1,
      totalContributors: 3,
      page: 1,
      pageSize: 1,
    });
    expect(page.items[0]).not.toHaveProperty('email');
    expect(repository.findCandidates).toHaveBeenCalledOnce();
  });

  it('returns an empty page without inventing contributors', async () => {
    const { service } = build([]);
    await expect(
      service.getContributors({ page: 1, pageSize: 20 }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      totalContributors: 0,
      page: 1,
      pageSize: 20,
    });
  });
});
