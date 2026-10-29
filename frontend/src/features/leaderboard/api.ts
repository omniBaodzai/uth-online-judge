export type LeaderboardEntry = {
  userId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  solvedCount: number
  cumulativePoints: number
  performancePercentile: number | null
  comparableProblems: number
  achievementAt: string | null
  rank: number
}

export type LeaderboardResponse = {
  items: LeaderboardEntry[]
  total: number
  totalUsers?: number
  page: number
  pageSize: number
  viewerRank: number | null
}

export type LeaderboardParams = {
  page: number
  pageSize: number
  q?: string
}

export type LeaderboardRequester = <T>(path: string, init?: RequestInit) => Promise<T>

export function buildLeaderboardQuery(params: LeaderboardParams): string {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) })
  if (params.q?.trim()) query.set('q', params.q.trim())
  return `?${query.toString()}`
}

export function fetchLeaderboard(requester: LeaderboardRequester, params: LeaderboardParams) {
  return requester<LeaderboardResponse>(`/leaderboard${buildLeaderboardQuery(params)}`)
}