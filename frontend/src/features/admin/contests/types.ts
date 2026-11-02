import type { AdminDifficulty } from '../types'

export type ContestPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ContestVisibility = 'PUBLIC' | 'PRIVATE'
export type ContestTimeStatus = 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNPUBLISHED'

export type ContestSettings = {
  visibility: ContestVisibility
  allowRegistration: boolean
  showLeaderboard: boolean
}

export type ContestProblem = {
  problemId: string
  problemCode: string
  problemTitle: string
  difficulty?: AdminDifficulty | null
  position?: number
  maxScore: number
  testCaseRevision?: number
}

export type Contest = {
  id: string
  slug: string
  title: string
  description: string | null
  rules: string | null
  startsAt: string
  endsAt: string
  publicationStatus: ContestPublicationStatus
  visibility: ContestSettings['visibility']
  allowRegistration: boolean
  showLeaderboard: boolean
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type ContestListItem = Contest & {
  timeStatus: ContestTimeStatus
  problemCount: number
  participantCount: number
}

export type ContestDetail = Contest & {
  problems: ContestProblem[]
  participantCount: number
}

export type ContestPage = {
  items: ContestListItem[]
  total: number
  page: number
  pageSize: number
}

export type ContestOverview = {
  total: number
  draft: number
  published: number
  archived: number
  upcoming: number
  ongoing: number
  ended: number
}

export type ContestFormValues = {
  slug: string
  title: string
  description: string
  rules: string
  startsAt: string
  endsAt: string
  settings: ContestSettings
  problems: ContestProblem[]
}

export type ContestListQuery = {
  page: number
  pageSize: number
  search?: string
  publicationStatus?: ContestPublicationStatus
  timeStatus?: Exclude<ContestTimeStatus, 'UNPUBLISHED'>
}

export type ContestInput = {
  slug: string
  title: string
  description: string | null
  rules: string | null
  startsAt: string
  endsAt: string
  visibility: ContestSettings['visibility']
  allowRegistration: boolean
  showLeaderboard: boolean
}

export type ReplaceContestProblemInput = {
  problemId: string
  maxScore: number
}
