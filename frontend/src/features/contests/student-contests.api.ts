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
