import type { Fetcher } from '../problems/api'

export type UserProfile = {
  username: string
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  bio: string | null
  school: string | null
  createdAt: string
  solvedCount: number
  rank: number | null
  totalScore: number
  contributions: number
  submissionCount: number
  contests: {
    attended: number
    rank: number | null
    currentRating: number | null
    minRating: number | null
    maxRating: number | null
    badgeTitle: string | null
  }
  heatmap: { date: string; count: number }[]
  ratingHistory: { contestName: string; date: string; rating: number }[]
}

export function fetchUserProfile(fetcher: Fetcher, username: string) {
  return fetcher<UserProfile>(`/users/profile/${encodeURIComponent(username)}`)
}

export function updateAbout(fetcher: Fetcher, input: { bio: string; school: string }) {
  return fetcher<{ bio: string | null; school: string | null }>('/users/me/about', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
