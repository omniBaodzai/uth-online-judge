import { Injectable } from '@nestjs/common';
import { ContributorsRepository } from './contributors.repository.js';
import type {
  ContributorCandidate,
  ContributorsPage,
  RankedContributor,
} from './contributors.types.js';

export interface ContributorsQuery {
  page: number;
  pageSize: number;
  q?: string;
}

function compareCandidates(
  left: ContributorCandidate,
  right: ContributorCandidate,
): number {
  const countDifference = right.contributionCount - left.contributionCount;
  if (countDifference !== 0) return countDifference;

  if (left.latestContributionAt !== right.latestContributionAt) {
    if (left.latestContributionAt === null) return 1;
    if (right.latestContributionAt === null) return -1;
    return left.latestContributionAt > right.latestContributionAt ? -1 : 1;
  }

  if (left.userId === right.userId) return 0;
  return left.userId < right.userId ? -1 : 1;
}

export function rankContributorCandidates(
  candidates: ContributorCandidate[],
): RankedContributor[] {
  return [...candidates]
    .sort(compareCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

@Injectable()
export class ContributorsService {
  constructor(private readonly contributors: ContributorsRepository) {}

  async getContributors(query: ContributorsQuery): Promise<ContributorsPage> {
    const ranked = rankContributorCandidates(
      await this.contributors.findCandidates(),
    );
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
      totalContributors: ranked.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
