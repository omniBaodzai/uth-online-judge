export type PublicProfile = {
  user: {
    id: string
    username: string | null
    displayName: string
    avatarUrl: string | null
    coverImageUrl: string | null
    coverCrop: {
      x: number
      y: number
      width: number
      height: number
      sourceWidth: number
      sourceHeight: number
      aspect: number
    } | null
    bio: string | null
    organization: string | null
    createdAt: string
  }
  stats: {
    rank: number | null
    solvedCount: number
    cumulativePoints: number
    submissionCount: number
    contributionCount: number
  }
  activity: { date: string; count: number }[]
  ratingHistory: { rating: number; date: string }[]
  contestStatistics: {
    participated: number
    highestRank: number | null
    currentRating: number | null
    lowestRating: number | null
    highestRating: number | null
    titles: string[]
  } | null
  achievements: { id: string; name: string; achievedAt: string }[]
}

export type ProfileViewModel = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  coverImageUrl: string | null
  coverCrop: PublicProfile['user']['coverCrop']
  bio: string
  organization: string
  joinedAt: string
  stats: PublicProfile['stats']
  contestStatistics: PublicProfile['contestStatistics']
  activity: PublicProfile['activity']
  ratingHistory: PublicProfile['ratingHistory']
  achievements: PublicProfile['achievements']
}

export function toProfileViewModel(profile: PublicProfile): ProfileViewModel {
  return {
    id: profile.user.id,
    username: profile.user.username ?? profile.user.id,
    displayName: profile.user.displayName,
    avatarUrl: profile.user.avatarUrl,
    coverImageUrl: profile.user.coverImageUrl,
    coverCrop: profile.user.coverCrop,
    bio: profile.user.bio ?? '',
    organization: profile.user.organization ?? '',
    joinedAt: profile.user.createdAt,
    stats: profile.stats,
    contestStatistics: profile.contestStatistics,
    activity: profile.activity,
    ratingHistory: profile.ratingHistory,
    achievements: profile.achievements,
  }
}

export type ProfileRequester = <T>(path: string, init?: RequestInit) => Promise<T>

export function publicProfilePath(identity: { username?: string; userId?: string }): string {
  if (identity.username) return `/users/${encodeURIComponent(identity.username)}`
  return `/users/id/${encodeURIComponent(identity.userId ?? '')}`
}

export function fetchPublicProfile(
  requester: ProfileRequester,
  identity: { username?: string; userId?: string },
) {
  return requester<PublicProfile>(publicProfilePath(identity))
}