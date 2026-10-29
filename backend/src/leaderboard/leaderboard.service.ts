import { Injectable } from '@nestjs/common';
import { LeaderboardRepository } from './leaderboard.repository.js';
import { rankLeaderboardCandidates } from './leaderboard-ranking.js';

export interface LeaderboardQuery {
  page: number;
  pageSize: number;
  q?: string;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly leaderboard: LeaderboardRepository) {}

  async findRankedUser(userId: string) {
    const ranked = rankLeaderboardCandidates(await this.leaderboard.findCandidates());
    return ranked.find((candidate) => candidate.userId === userId) ?? null;
  }

  async getLeaderboard(query: LeaderboardQuery, viewerId: string | null) {
    const ranked = rankLeaderboardCandidates(await this.leaderboard.findCandidates());
    const normalizedQuery = query.q?.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? ranked.filter((candidate) =>
          candidate.username?.toLocaleLowerCase().includes(normalizedQuery),
        )
      : ranked;
    const offset = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(offset, offset + query.pageSize),
      total: filtered.length,
      totalUsers: ranked.length,
      page: query.page,
      pageSize: query.pageSize,
      viewerRank: viewerId ? ranked.find((candidate) => candidate.userId === viewerId)?.rank ?? null : null,
    };
  }
}