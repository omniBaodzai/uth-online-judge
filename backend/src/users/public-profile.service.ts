import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaderboardService } from '../leaderboard/leaderboard.service.js';
import { PublicProfileRepository, type PublicProfileRecord } from './public-profile.repository.js';

export class PublicProfileNotFoundError extends NotFoundException {
  constructor() {
    super('Không tìm thấy hồ sơ công khai.');
  }
}

@Injectable()
export class PublicProfileService {
  constructor(
    private readonly profiles: PublicProfileRepository,
    private readonly leaderboard: LeaderboardService,
  ) {}

  getByUsername(username: string) {
    return this.buildProfile(() => this.profiles.findByUsername(username));
  }

  getById(id: string) {
    return this.buildProfile(() => this.profiles.findById(id));
  }

  private async buildProfile(find: () => Promise<PublicProfileRecord | null>) {
    const profile = await find();
    if (!profile) throw new PublicProfileNotFoundError();

    const [ranked, activity] = await Promise.all([
      this.leaderboard.findRankedUser(profile.id),
      this.profiles.listActivity(profile.id),
    ]);

    return {
      user: {
        id: profile.id,
        username: profile.username,
        displayName: profile.full_name?.trim() || profile.username || 'Người dùng UTH',
        avatarUrl: profile.avatar_url,
        coverImageUrl: profile.cover_image_url,
        coverCrop: profile.cover_crop,
        bio: profile.bio,
        organization: profile.organization,
        createdAt: profile.created_at instanceof Date
          ? profile.created_at.toISOString()
          : profile.created_at,
      },
      stats: {
        rank: ranked?.rank ?? null,
        solvedCount: ranked?.solvedCount ?? 0,
        cumulativePoints: ranked?.cumulativePoints ?? 0,
        submissionCount: Number(profile.submission_count),
        contributionCount: Number(profile.contribution_count),
      },
      activity,
      ratingHistory: [],
      contestStatistics: null,
      achievements: [],
    };
  }
}