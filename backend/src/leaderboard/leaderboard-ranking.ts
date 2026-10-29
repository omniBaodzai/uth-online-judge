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
}

export type RankedLeaderboardCandidate = LeaderboardCandidate & { rank: number };

function compareCandidates(
  left: LeaderboardCandidate,
  right: LeaderboardCandidate,
): number {
  const solvedDifference = right.solvedCount - left.solvedCount;
  if (solvedDifference !== 0) return solvedDifference;

  const pointsDifference = right.cumulativePoints - left.cumulativePoints;
  if (pointsDifference !== 0) return pointsDifference;

  const leftPerformance = left.performancePercentile ?? 0.5;
  const rightPerformance = right.performancePercentile ?? 0.5;
  if (leftPerformance !== rightPerformance) return leftPerformance - rightPerformance;

  if (left.achievementAt && right.achievementAt) {
    const timeDifference = Date.parse(left.achievementAt) - Date.parse(right.achievementAt);
    if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
  } else if (left.achievementAt || right.achievementAt) {
    return left.achievementAt ? -1 : 1;
  }

  return left.userId.localeCompare(right.userId);
}

export function rankLeaderboardCandidates(
  candidates: LeaderboardCandidate[],
): RankedLeaderboardCandidate[] {
  return [...candidates]
    .sort(compareCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}