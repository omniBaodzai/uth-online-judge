import type { AdminDifficulty } from '../types'

export type ContestPublicationStatus = 'draft' | 'published' | 'archived'
export type ContestVisibility = 'public' | 'private'

export type ContestSettings = {
  visibility: ContestVisibility
  allowRegistration: boolean
  showLeaderboard: boolean
}

export type ContestProblem = {
  problemId: string
  code: string
  title: string
  difficulty: AdminDifficulty
  maxScore: number
}

export type Contest = {
  id: string
  code: string
  title: string
  description: string
  rules: string
  startTime: string
  endTime: string
  durationMinutes: number
  participantCount: number
  publicationStatus: ContestPublicationStatus
  settings: ContestSettings
  problems: ContestProblem[]
  studentPageId?: string
}

export type ContestFormValues = Omit<Contest, 'id' | 'participantCount' | 'publicationStatus'> & {
  id?: string
}
