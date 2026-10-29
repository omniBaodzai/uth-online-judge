import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PublicProfileService } from './public-profile.service.js';

function build() {
  const profiles = {
    findByUsername: vi.fn(),
    findById: vi.fn(),
    listActivity: vi.fn().mockResolvedValue([{ date: '2026-01-03', count: 2 }]),
  };
  const leaderboard = {
    findRankedUser: vi.fn().mockResolvedValue({
      rank: 2, solvedCount: 3, cumulativePoints: 12,
    }),
  };
  return {
    profiles,
    leaderboard,
    service: new PublicProfileService(profiles as never, leaderboard as never),
  };
}

describe('PublicProfileService', () => {
  it('returns real public profile, activity and leaderboard stats without private email', async () => {
    const { profiles, leaderboard, service } = build();
    profiles.findByUsername.mockResolvedValue({
      id: 'user-id', username: 'coder', full_name: 'Coder Name', avatar_url: null,
      cover_image_url: null, cover_crop: null, bio: 'Hello', organization: 'UTH',
      created_at: new Date('2026-01-01T00:00:00Z'),
      submission_count: 7, contribution_count: 4, email: 'private@example.com',
    });

    const result = await service.getByUsername('coder');
    expect(result.user).toMatchObject({ username: 'coder', bio: 'Hello' });
    expect(result).toMatchObject({
      user: { organization: 'UTH', coverCrop: null },
      stats: { rank: 2, solvedCount: 3, cumulativePoints: 12, submissionCount: 7, contributionCount: 4 },
      activity: [{ date: '2026-01-03', count: 2 }],
      ratingHistory: [], contestStatistics: null, achievements: [],
    });
    expect(result.user).not.toHaveProperty('email');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).not.toHaveProperty('refresh_token');
    expect(leaderboard.findRankedUser).toHaveBeenCalledWith('user-id');
  });

  it('shows zero rank metrics for a profile without leaderboard results', async () => {
    const { profiles, leaderboard, service } = build();
    profiles.findById.mockResolvedValue({
      id: 'new-user', username: 'newbie', full_name: null, avatar_url: null,
      cover_image_url: null, cover_crop: null, bio: null, organization: null,
      created_at: '2026-01-01T00:00:00Z', submission_count: 0, contribution_count: 0,
    });
    leaderboard.findRankedUser.mockResolvedValue(null);
    await expect(service.getById('new-user')).resolves.toMatchObject({
      stats: { rank: null, solvedCount: 0, cumulativePoints: 0, submissionCount: 0, contributionCount: 0 },
      activity: [{ date: '2026-01-03', count: 2 }],
    });
  });

  it('returns not found for a missing username', async () => {
    const { profiles, service } = build();
    profiles.findByUsername.mockResolvedValue(null);
    await expect(service.getByUsername('unknown')).rejects.toBeInstanceOf(NotFoundException);
  });
});