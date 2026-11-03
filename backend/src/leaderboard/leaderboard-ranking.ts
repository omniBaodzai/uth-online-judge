export interface LeaderboardCandidate {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  solvedCount: number;
  cumulativePoints: number;
  performancePercentile: number | null;
  comparableProblems: number;
  achievementAt: string | null;
  createdAt: string;
}

export type RankedLeaderboardCandidate = Omit<LeaderboardCandidate, 'createdAt'> & { rank: number };

function compareCandidates(
  left: LeaderboardCandidate,
  right: LeaderboardCandidate,
): number {
  const pointsDifference = right.cumulativePoints - left.cumulativePoints;
  if (pointsDifference !== 0) return pointsDifference;

  const solvedDifference = right.solvedCount - left.solvedCount;
  if (solvedDifference !== 0) return solvedDifference;

  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -1 : 1;
  }

  if (left.userId === right.userId) return 0;
  return left.userId < right.userId ? -1 : 1;
}

export function rankLeaderboardCandidates(
  candidates: LeaderboardCandidate[],
): RankedLeaderboardCandidate[] {
  return [...candidates]
    .sort(compareCandidates)
    .map(({ createdAt: _createdAt, ...candidate }, index) => ({
      ...candidate,
      rank: index + 1,
    }));
}