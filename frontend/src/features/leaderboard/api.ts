import type { Fetcher } from '../problems/api'

export type LeaderboardItem = {
  rank: number
  username: string
  fullName: string | null
  avatarUrl: string | null
  rating: number | null
  totalScore: number
  solvedCount: number
  contributions: number
}

export type LeaderboardPage = { items: LeaderboardItem[]; total: number; page: number; pageSize: number }

export function fetchLeaderboard(
  fetcher: Fetcher,
  params: { page: number; pageSize: number; q: string; sort: 'score' | 'contributions' },
) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sort: params.sort,
  })
  if (params.q) query.set('q', params.q)
  return fetcher<LeaderboardPage>(`/users/leaderboard?${query.toString()}`)
}
