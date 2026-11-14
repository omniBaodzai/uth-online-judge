export interface ContributorCandidate {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  contributionCount: number;
  latestContributionAt: string | null;
}

export type RankedContributor = ContributorCandidate & { rank: number };

export interface ContributorsPage {
  items: RankedContributor[];
  total: number;
  totalContributors: number;
  page: number;
  pageSize: number;
}
