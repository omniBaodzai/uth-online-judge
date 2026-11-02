import { request as publicRequest } from '../auth/api'

export type StudentContestTimeStatus = 'UPCOMING' | 'ONGOING' | 'ENDED'
export type StudentContestRegistrationStatus = 'REGISTERED' | 'CANCELLED'
export type StudentContestSortField = 'startsAt' | 'endsAt' | 'title' | 'participantCount'
export type StudentContestSortOrder = 'asc' | 'desc'

export type StudentContestListItem = {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  timeStatus: StudentContestTimeStatus
  allowRegistration: boolean
  canRegister: boolean
  isRegistered: boolean
  participantCount: number
}

export type StudentContestProblem = {
  problemId: string
  problemCode: string
  problemTitle: string
  position: number
  maxScore: number
}

export type StudentContestDetail = StudentContestListItem & {
  rules: string | null
  isRegistered: boolean
  registrationStatus: StudentContestRegistrationStatus | null
  problems: StudentContestProblem[]
}

export type StudentContestPage = {
  items: StudentContestListItem[]
  total: number
  page: number
  pageSize: number
}

export type StudentContestRegistration = {
  contestId: string
  registrationStatus: StudentContestRegistrationStatus
  registeredAt: string
}

export type StudentContestParticipantStatus = 'registered' | 'participated'

export type StudentContestParticipant = {
  userId: string
  username: string
  avatarUrl: string | null
  registeredAt: string
  status: StudentContestParticipantStatus
}

export type StudentContestParticipantsPage = {
  items: StudentContestParticipant[]
  total: number
  participantCount: number
  page: number
  pageSize: 10 | 20 | 50
}

export type StudentContestSubmissionStatusCount = {
  status: string
  count: number
}

export type StudentContestStatistics = {
  totalParticipants: number
  totalProblems: number
  totalSubmissions: number
  acceptedSubmissions: number
  wrongAnswerSubmissions: number
  timeLimitSubmissions: number
  runtimeErrorSubmissions: number
  pendingSubmissions: number
  otherSubmissions: number
  activeSubmitters: number
  solvedParticipants: number
  statusCounts: StudentContestSubmissionStatusCount[]
  problemStatistics: Array<{
    problemId: string
    problemCode: string
    problemTitle: string
    totalSubmissions: number
    acceptedSubmissions: number
    statusCounts: StudentContestSubmissionStatusCount[]
  }>
  languageStatistics: Array<{
    languageId: string
    languageName: string
    totalSubmissions: number
    acceptedSubmissions: number
    statusCounts: StudentContestSubmissionStatusCount[]
  }>
}

export type StudentContestLeaderboardEntry = {
  rank: number
  userId: string
  username: string | null
  avatarUrl: string | null
  totalScore: number
  acceptedProblems: number
  totalProblems: number
  elapsedSeconds: number | null
}

export type StudentContestLeaderboardPage = {
  items: StudentContestLeaderboardEntry[]
  total: number
  totalParticipants: number
  page: number
  pageSize: 10 | 20 | 50
}

export type StudentContestSubmissionItem = {
  id: string
  status: string
  submittedAt: string
  username: string | null
  problemCode: string
  problemTitle: string
  language: string
  executionTimeMs: number | null
  memoryUsedKb: number | null
  canViewDetails: boolean
}

export type StudentContestSubmissionsPage = {
  items: StudentContestSubmissionItem[]
  total: number
  page: number
  pageSize: 10 | 20 | 50
  statistics: {
    total: number
    accepted: number
    acceptanceRate: number
    verdictCounts: Record<string, number>
  }
  filters: { languages: string[] }
}

export type StudentContestRequester = <T>(
  path: string,
  init?: RequestInit,
) => Promise<T>

export type StudentContestListQuery = {
  page: number
  pageSize: number
  search: string
  timeStatus: StudentContestTimeStatus
  sort: StudentContestSortField
  order: StudentContestSortOrder
}

export function getStudentContestPage(
  query: StudentContestListQuery,
  requester: StudentContestRequester = publicRequest,
  signal?: AbortSignal,
): Promise<StudentContestPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    timeStatus: query.timeStatus,
    sort: query.sort,
    order: query.order,
  })
  if (query.search) searchParams.set('search', query.search)

  return requester<StudentContestPage>(`/contests?${searchParams}`, { signal })
}

export function getStudentContest(
  requester: StudentContestRequester,
  identifier: string,
  signal?: AbortSignal,
): Promise<StudentContestDetail> {
  return requester<StudentContestDetail>(
    `/contests/${encodeURIComponent(identifier)}`,
    { signal },
  )
}

export function getStudentContestStatistics(
  requester: StudentContestRequester,
  identifier: string,
  signal?: AbortSignal,
): Promise<StudentContestStatistics> {
  return requester<StudentContestStatistics>(
    `/contests/${encodeURIComponent(identifier)}/statistics`,
    { signal },
  )
}

export function getStudentContestLeaderboard(
  requester: StudentContestRequester,
  identifier: string,
  query: { page: number; pageSize: 10 | 20 | 50; search: string },
  signal?: AbortSignal,
): Promise<StudentContestLeaderboardPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.search.trim()) searchParams.set('search', query.search.trim())

  return requester<StudentContestLeaderboardPage>(
    `/contests/${encodeURIComponent(identifier)}/leaderboard?${searchParams}`,
    { signal },
  )
}

export function getStudentContestParticipants(
  requester: StudentContestRequester,
  identifier: string,
  query: {
    page: number
    pageSize: 10 | 20 | 50
    search: string
    status: 'all' | StudentContestParticipantStatus
  },
  signal?: AbortSignal,
): Promise<StudentContestParticipantsPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    status: query.status,
  })
  if (query.search.trim()) searchParams.set('search', query.search.trim())

  return requester<StudentContestParticipantsPage>(
    `/contests/${encodeURIComponent(identifier)}/participants?${searchParams}`,
    { signal },
  )
}

export function getStudentContestSubmissions(
  requester: StudentContestRequester,
  identifier: string,
  query: {
    page: number
    pageSize: 10 | 20 | 50
    search: string
    status?: string
    language?: string
  },
  signal?: AbortSignal,
): Promise<StudentContestSubmissionsPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.search.trim()) searchParams.set('search', query.search.trim())
  if (query.status) searchParams.set('status', query.status)
  if (query.language) searchParams.set('language', query.language)

  return requester<StudentContestSubmissionsPage>(
    `/contests/${encodeURIComponent(identifier)}/submissions?${searchParams}`,
    { signal },
  )
}

export function registerForStudentContest(
  requester: StudentContestRequester,
  identifier: string,
): Promise<StudentContestRegistration> {
  return requester<StudentContestRegistration>(
    `/contests/${encodeURIComponent(identifier)}/registration`,
    { method: 'POST' },
  )
}

export function cancelStudentContestRegistration(
  requester: StudentContestRequester,
  identifier: string,
): Promise<StudentContestRegistration> {
  return requester<StudentContestRegistration>(
    `/contests/${encodeURIComponent(identifier)}/registration`,
    { method: 'DELETE' },
  )
}
