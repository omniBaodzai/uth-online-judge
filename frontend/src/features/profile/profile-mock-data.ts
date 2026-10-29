import type { AuthUser } from '../auth/api'
import type { ActivityRecord } from './profile-activity'

export type MockRatingPoint = { date: string; rating: number }
export type MockAchievement = { id: string; name: string; achievedAt: string }

export interface MockProfile {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  coverImageUrl: string | null
  bio: string
  organization: string
  joinedAt: string
  stats: {
    solvedCount: number
    rank: number | null
    cumulativePoints: number
    contributionCount: number
    submissionCount: number
  }
  contestStatistics: {
    participated: number
    highestRank: number | null
    currentRating: number | null
    lowestRating: number | null
    highestRating: number | null
    titles: string[]
  }
  activity: ActivityRecord[]
  ratingHistory: MockRatingPoint[]
  achievements: MockAchievement[]
}

function dateDaysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function sampleActivity(): ActivityRecord[] {
  return [
    { date: dateDaysAgo(330), count: 1 },
    { date: dateDaysAgo(212), count: 2 },
    { date: dateDaysAgo(113), count: 1 },
    { date: dateDaysAgo(61), count: 1 },
    { date: dateDaysAgo(20), count: 1 },
  ]
}

function createProfile(
  username: string,
  patch: Partial<MockProfile> = {},
): MockProfile {
  return {
    id: `mock-${username}`,
    username,
    displayName: username,
    email: `${username}@example.test`,
    avatarUrl: null,
    coverImageUrl: null,
    bio: '',
    organization: 'Trường Đại học Giao thông Vận tải Thành phố Hồ Chí Minh',
    joinedAt: '2026-10-27T08:00:00.000Z',
    stats: {
      solvedCount: 0,
      rank: null,
      cumulativePoints: 0,
      contributionCount: 0,
      submissionCount: 0,
    },
    contestStatistics: {
      participated: 0,
      highestRank: null,
      currentRating: null,
      lowestRating: null,
      highestRating: null,
      titles: [],
    },
    activity: [],
    ratingHistory: [],
    achievements: [],
    ...patch,
  }
}

export const mockProfiles: MockProfile[] = [
  createProfile('hv1', {
    displayName: 'hv1',
    email: 'hv1@example.test',
    bio: 'Hello mọi con vịt!!!!!',
    stats: { solvedCount: 1, rank: 1, cumulativePoints: 30, contributionCount: 2, submissionCount: 6 },
    activity: sampleActivity(),
  }),
  createProfile('test4', {
    stats: { solvedCount: 1, rank: 2, cumulativePoints: 20, contributionCount: 0, submissionCount: 20 },
    activity: sampleActivity(),
  }),
  createProfile('test3'),
  createProfile('test2'),
  createProfile('dbg89314'),
  createProfile('lebao'),
]

export function getMockProfileByUsername(username: string | undefined): MockProfile | null {
  if (!username) return null
  return mockProfiles.find((profile) => profile.username.toLocaleLowerCase() === username.toLocaleLowerCase()) ?? null
}

export function getMockProfileById(id: string | undefined): MockProfile | null {
  if (!id) return null
  return mockProfiles.find((profile) => profile.id === id) ?? null
}

export function getPersonalMockProfile(user: AuthUser): MockProfile {
  const base = getMockProfileByUsername(user.username ?? undefined) ?? createProfile(user.username ?? 'coder')
  return {
    ...base,
    id: user.id,
    username: user.username ?? base.username,
  }
}