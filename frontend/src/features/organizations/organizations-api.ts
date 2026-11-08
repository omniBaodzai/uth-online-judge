import { ApiError } from '../auth/api'

export type ApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export type OrganizationStatus = 'ACTIVE' | 'ARCHIVED'
export type OrganizationVisibility = 'PUBLIC' | 'PRIVATE'
export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type OrganizationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type PublicProfile = {
  id: string
  username: string | null
  fullName: string | null
  avatarUrl: string | null
}

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export type OrganizationSummary = {
  id: string
  slug: string
  name: string
  description: string | null
  websiteUrl: string | null
  status: OrganizationStatus
  problemsVisibility: OrganizationVisibility
  contestsVisibility: OrganizationVisibility
  submissionsVisibility: OrganizationVisibility
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  memberCount: number
  owner: PublicProfile | null
}

export type ViewerPermissions = {
  isSystemAdmin: boolean
  canManage: boolean
  canEditInfo: boolean
  canEditVisibility: boolean
  canViewProblems: boolean
  canViewContests: boolean
  canViewSubmissions: boolean
}

export type OrganizationDetail = OrganizationSummary & {
  archivedBy?: PublicProfile | null
  viewerRole: OrganizationMemberRole | null
  viewerPermissions: ViewerPermissions
}

export type OrganizationProblem = {
  id: string
  code: string
  title: string
  summary: string | null
  statement: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  languages: string[]
  inputDescription: string
  outputDescription: string
  constraints: string
  timeLimitSeconds: number
  memoryLimitMb: number
  testCaseRevision: number
  status: 'draft' | 'published' | 'archived'
  examples: Array<{ id: string; input: string; output: string }>
  editorials: Array<{ id: string; title: string; language: string; sourceCode: string }>
}

export type OrganizationProblemInput = {
  code: string
  title: string
  summary?: string | null
  statement: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags: string[]
  languages: string[]
  inputDescription?: string | null
  outputDescription?: string | null
  constraints?: string | null
  timeLimitSeconds: number
  memoryLimitMb: number
  status?: OrganizationProblem['status']
  testCases?: Array<{ name: string; input: string; expectedOutput: string; kind: 'sample' | 'hidden' }>
  testCasesRevision?: number
  editorials?: Array<{ id?: string; title: string; language: string; sourceCode: string }>
}

export type OrganizationTestCases = {
  revision: number
  cases: Array<{
    id: string
    name: string
    input: string
    expectedOutput: string
    kind: 'sample' | 'hidden'
    points: 1
    position: number
  }>
}

export type OrganizationContest = {
  id: string
  slug: string
  title: string
  description: string | null
  rules: string | null
  startsAt: string
  endsAt: string
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  visibility: OrganizationVisibility
  allowRegistration: boolean
  showLeaderboard: boolean
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  participantCount: number
  problems: Array<{
    problemId: string
    problemCode: string
    problemTitle: string
    position: number
    maxScore: number
    testCaseRevision: number
  }>
}

export type OrganizationContestProblemOption = {
  id: string
  code: string
  title: string
  organizationName: string | null
}

export type OrganizationProblemGrant = {
  id: string
  problemId: string
  scope: 'ORGANIZATION' | 'GLOBAL_CONTESTS'
  granteeOrganization: { id: string; slug: string; name: string } | null
  grantedBy: string
  grantedAt: string
  revokedBy: string | null
  revokedAt: string | null
}

export type OrganizationSubmission = {
  id: string
  status: string
  submittedAt: string
  username?: string | null
  problemCode?: string | null
  problemTitle?: string | null
  language: string
  executionTimeMs: number | null
  memoryUsedKb: number | null
  score?: number
  maxScore?: number
  contestId?: string | null
  canViewDetails?: boolean
}

export type OrganizationSubmissionPage = Page<OrganizationSubmission>

export type OrganizationSubmissionDetail = {
  id: string
  problemCode: string
  problemTitle: string
  username: string | null
  language: string
  status: string
  scoringEnabled: boolean
  score: number
  maxScore: number
  executionTimeMs: number | null
  memoryUsedKb: number | null
  submittedAt: string
  judgedAt: string | null
  testResults: Array<{
    position: number
    status: string | null
    executionTimeMs: number | null
    memoryUsedKb: number | null
    pointsAwarded: number
    maxPoints: number
  }>
}

export type AdminOrganization = OrganizationSummary & { archivedBy: PublicProfile | null }

export type AdminOrganizationDetail = AdminOrganization & { sourceRequestId: string | null }

export type OrganizationMember = PublicProfile & { role: OrganizationMemberRole; joinedAt: string }

export type OrganizationLeaderboardEntry = {
  rank: number
  userId: string
  username: string
  solvedCount: number
}

export type OrganizationRequest = {
  id: string
  fullName: string
  workplace: string
  position: string
  phoneNumber: string
  motivation: string
  status: OrganizationRequestStatus
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  createdOrganization: { id: string; slug: string; name: string } | null
}

export type AdminOrganizationRequest = OrganizationRequest & {
  requester: (PublicProfile & { email: string }) | null
  reviewer: PublicProfile | null
  createdOrganizationDetails: {
    id: string
    slug: string
    name: string
    status: OrganizationStatus
    owner: PublicProfile | null
  } | null
}

export type RequestStatistics = Record<OrganizationRequestStatus, number> & { total: number }

export type AdminRequestPage = Page<AdminOrganizationRequest> & { statistics: RequestStatistics }

export type NewRequestInput = {
  fullName: string
  workplace: string
  position: string
  phoneNumber: string
  motivation: string
}

export type OrganizationFormInput = {
  name: string
  slug?: string
  description?: string | null
  websiteUrl?: string | null
  ownerIdentifier?: string | null
}

export type VisibilityInput = Partial<{
  problemsVisibility: OrganizationVisibility
  contestsVisibility: OrganizationVisibility
  submissionsVisibility: OrganizationVisibility
}>

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function json(method: string, body: unknown, signal?: AbortSignal): RequestInit {
  return { method, body: JSON.stringify(body), signal }
}

const slugPath = (slug: string) => encodeURIComponent(slug)

// ----- Người dùng -----

export const submitOrganizationRequest = (api: ApiRequest, input: NewRequestInput) =>
  api<OrganizationRequest>('/organization-requests', json('POST', input))

export const listMyOrganizationRequests = (api: ApiRequest, page = 1, pageSize = 10) =>
  api<Page<OrganizationRequest>>(`/organization-requests/me${query({ page, pageSize })}`)

export const listOrganizations = (
  api: ApiRequest,
  params: { page: number; pageSize: number; q?: string; sort?: 'members' | 'newest' | 'name' },
  signal?: AbortSignal,
) => api<Page<OrganizationSummary>>(`/organizations${query(params)}`, { signal })

export const getOrganization = (api: ApiRequest, slug: string, signal?: AbortSignal) =>
  api<OrganizationDetail>(`/organizations/${slugPath(slug)}`, { signal })

export const getOrganizationManage = (api: ApiRequest, slug: string, signal?: AbortSignal) =>
  api<OrganizationDetail>(`/organizations/${slugPath(slug)}/manage`, { signal })

export const listOrganizationMembers = (
  api: ApiRequest,
  slug: string,
  params: { page: number; pageSize: number; q?: string; role?: OrganizationMemberRole },
  signal?: AbortSignal,
) => api<Page<OrganizationMember>>(`/organizations/${slugPath(slug)}/members${query(params)}`, { signal })

export const listOrganizationLeaderboard = (
  api: ApiRequest,
  slug: string,
  params: { page: number; pageSize: number },
  signal?: AbortSignal,
) => api<Page<OrganizationLeaderboardEntry>>(
  `/organizations/${slugPath(slug)}/leaderboard${query(params)}`,
  { signal },
)

export type AssignableRole = 'ADMIN' | 'MEMBER'

export const joinOrganization = (api: ApiRequest, slug: string) =>
  api<OrganizationDetail>(`/organizations/${slugPath(slug)}/join`, { method: 'POST' })

export const leaveOrganization = (api: ApiRequest, slug: string) =>
  api<OrganizationDetail>(`/organizations/${slugPath(slug)}/leave`, { method: 'POST' })

export const listOrganizationProblems = (
  api: ApiRequest,
  slug: string,
  params: { page?: number; pageSize?: number; search?: string; status?: OrganizationProblem['status']; difficulty?: OrganizationProblem['difficulty'] } = {},
  signal?: AbortSignal,
) => api<Page<OrganizationProblem>>(`/organizations/${slugPath(slug)}/problems${query(params)}`, { signal })

export const getOrganizationSubmissionLanguages = (
  api: ApiRequest,
  slug: string,
  problemId: string,
  signal?: AbortSignal,
) => api<Array<{ slug: string; name: string }>>(
  `/organizations/${slugPath(slug)}/submissions/languages/${encodeURIComponent(problemId)}`,
  { signal },
)

export const getOrganizationContestSubmissionLanguages = (
  api: ApiRequest,
  slug: string,
  contestId: string,
  problemId: string,
  signal?: AbortSignal,
) => api<Array<{ slug: string; name: string }>>(
  `/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/submission-languages/${encodeURIComponent(problemId)}`,
  { signal },
)

export const submitOrganizationSolution = (
  api: ApiRequest,
  slug: string,
  input: { problemCode: string; language: string; sourceCode: string },
) => api<{ id: string; status: string; submittedAt: string }>(
  `/organizations/${slugPath(slug)}/submissions`,
  json('POST', input),
)

export const submitOrganizationContestSolution = (
  api: ApiRequest,
  slug: string,
  contestId: string,
  input: { problemCode: string; language: string; sourceCode: string },
) => api<{ id: string; status: string; submittedAt: string }>(
  `/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/submissions`,
  json('POST', input),
)

export const listOrganizationSubmissions = (
  api: ApiRequest,
  slug: string,
  params: { page: number; pageSize: number; problemId?: string; contestId?: string; status?: string; language?: string },
  signal?: AbortSignal,
) => api<OrganizationSubmissionPage>(
  `/organizations/${slugPath(slug)}/submissions${query(params)}`,
  { signal },
)

export const listMyOrganizationSubmissions = (
  api: ApiRequest,
  slug: string,
  params: { page: number; pageSize: number; problemId?: string; contestId?: string; status?: string; language?: string },
  signal?: AbortSignal,
) => api<OrganizationSubmissionPage>(
  `/organizations/${slugPath(slug)}/submissions/mine${query(params)}`,
  { signal },
)

export const getOrganizationSubmission = (
  api: ApiRequest,
  slug: string,
  submissionId: string,
  signal?: AbortSignal,
) => api<OrganizationSubmissionDetail>(
  `/organizations/${slugPath(slug)}/submissions/${encodeURIComponent(submissionId)}`,
  { signal },
)

export const getOrganizationSubmissionSource = (
  api: ApiRequest,
  slug: string,
  submissionId: string,
  signal?: AbortSignal,
) => api<{ sourceCode: string }>(
  `/organizations/${slugPath(slug)}/submissions/${encodeURIComponent(submissionId)}/source`,
  { signal },
)

export const getOrganizationProblem = (api: ApiRequest, slug: string, problemId: string, signal?: AbortSignal) =>
  api<OrganizationProblem>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}`, { signal })

export const createOrganizationProblem = (api: ApiRequest, slug: string, input: OrganizationProblemInput) =>
  api<OrganizationProblem>(`/organizations/${slugPath(slug)}/problems`, json('POST', input))

export const updateOrganizationProblem = (api: ApiRequest, slug: string, problemId: string, input: OrganizationProblemInput) =>
  api<OrganizationProblem>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}`, json('PATCH', input))

export const setOrganizationProblemStatus = (
  api: ApiRequest,
  slug: string,
  problemId: string,
  status: OrganizationProblem['status'],
) => api<OrganizationProblem>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}/status`, json('PATCH', { status }))

export const deleteOrganizationProblem = (api: ApiRequest, slug: string, problemId: string) =>
  api<void>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}`, { method: 'DELETE' })

export const getOrganizationProblemTestCases = (api: ApiRequest, slug: string, problemId: string) =>
  api<OrganizationTestCases>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}/test-cases`)

export const listOrganizationProblemGrants = (api: ApiRequest, slug: string, problemId: string) =>
  api<OrganizationProblemGrant[]>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}/grants`)

export const createOrganizationProblemGrant = (
  api: ApiRequest,
  slug: string,
  problemId: string,
  input: { scope: 'ORGANIZATION' | 'GLOBAL_CONTESTS'; granteeOrganizationId?: string },
) => api<OrganizationProblemGrant>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}/grants`, json('POST', input))

export const revokeOrganizationProblemGrant = (api: ApiRequest, slug: string, problemId: string, grantId: string) =>
  api<OrganizationProblemGrant>(`/organizations/${slugPath(slug)}/problems/${encodeURIComponent(problemId)}/grants/${encodeURIComponent(grantId)}`, { method: 'DELETE' })

export const listOrganizationContests = (
  api: ApiRequest,
  slug: string,
  params: { page?: number; pageSize?: number; search?: string; publicationStatus?: OrganizationContest['publicationStatus']; visibility?: OrganizationVisibility } = {},
  signal?: AbortSignal,
) => api<Page<OrganizationContest>>(`/organizations/${slugPath(slug)}/contests${query(params)}`, { signal })

export const getOrganizationContest = (api: ApiRequest, slug: string, contestId: string, signal?: AbortSignal) =>
  api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}`, { signal })

export const getOrganizationContestProblem = (api: ApiRequest, slug: string, contestId: string, problemId: string, signal?: AbortSignal) =>
  api<Omit<OrganizationProblem, 'editorials'>>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/problems/${encodeURIComponent(problemId)}`, { signal })

export const listOrganizationContestProblemOptions = (api: ApiRequest, slug: string, search?: string) =>
  api<OrganizationContestProblemOption[]>(`/organizations/${slugPath(slug)}/contests/problem-options${query({ search })}`)

export const createOrganizationContest = (
  api: ApiRequest,
  slug: string,
  input: { slug: string; title: string; description?: string | null; rules?: string | null; startsAt: string; endsAt: string; visibility: OrganizationVisibility },
) => api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests`, json('POST', input))

export const updateOrganizationContest = (
  api: ApiRequest,
  slug: string,
  contestId: string,
  input: Partial<{ slug: string; title: string; description: string | null; rules: string | null; startsAt: string; endsAt: string; visibility: OrganizationVisibility }>,
) => api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}`, json('PATCH', input))

export const replaceOrganizationContestProblems = (
  api: ApiRequest,
  slug: string,
  contestId: string,
  problems: Array<{ problemId: string; maxScore: number }>,
) => api<OrganizationContest['problems']>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/problems`, json('PUT', { problems }))

export const publishOrganizationContest = (api: ApiRequest, slug: string, contestId: string) =>
  api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/publish`, { method: 'POST' })

export const archiveOrganizationContest = (api: ApiRequest, slug: string, contestId: string) =>
  api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/archive`, { method: 'POST' })

export const restoreOrganizationContest = (api: ApiRequest, slug: string, contestId: string) =>
  api<OrganizationContest>(`/organizations/${slugPath(slug)}/contests/${encodeURIComponent(contestId)}/restore`, { method: 'POST' })

export const addOrganizationMember = (api: ApiRequest, slug: string, identifier: string, role: AssignableRole) =>
  api<OrganizationMember>(`/organizations/${slugPath(slug)}/members`, json('POST', { identifier, role }))

export const changeOrganizationMemberRole = (api: ApiRequest, slug: string, userId: string, role: AssignableRole) =>
  api<OrganizationMember>(`/organizations/${slugPath(slug)}/members/${userId}`, json('PATCH', { role }))

export const removeOrganizationMember = (api: ApiRequest, slug: string, userId: string) =>
  api<{ removed: true }>(`/organizations/${slugPath(slug)}/members/${userId}`, { method: 'DELETE' })

export type MemberActions = { canChangeRole: boolean; canRemove: boolean }

// Phản chiếu chính sách backend để chỉ hiển thị thao tác được phép; backend vẫn kiểm tra lại.
export function memberActions(
  viewer: { isSystemAdmin: boolean; role: OrganizationMemberRole | null },
  target: OrganizationMemberRole,
  isSelf: boolean,
): MemberActions {
  if (target === 'OWNER' || isSelf) return { canChangeRole: false, canRemove: false }
  const full = viewer.isSystemAdmin || viewer.role === 'OWNER'
  return {
    canChangeRole: full,
    canRemove: full || (viewer.role === 'ADMIN' && target === 'MEMBER'),
  }
}

export const updateOrganizationInfo = (
  api: ApiRequest,
  slug: string,
  input: { name?: string; slug?: string; description?: string | null; websiteUrl?: string | null },
) => api<OrganizationDetail>(`/organizations/${slugPath(slug)}`, json('PATCH', input))

export const updateOrganizationVisibility = (api: ApiRequest, slug: string, input: VisibilityInput) =>
  api<OrganizationDetail>(`/organizations/${slugPath(slug)}/visibility`, json('PATCH', input))

// ----- Admin hệ thống -----

export const listAdminOrganizations = (
  api: ApiRequest,
  params: { page: number; pageSize: number; q?: string; status?: OrganizationStatus; sort?: 'members' | 'newest' | 'name' },
  signal?: AbortSignal,
) => api<Page<AdminOrganization>>(`/admin/organizations${query(params)}`, { signal })

export const createAdminOrganization = (api: ApiRequest, input: OrganizationFormInput) =>
  api<AdminOrganization>('/admin/organizations', json('POST', input))

export const getAdminOrganization = (api: ApiRequest, id: string, signal?: AbortSignal) =>
  api<AdminOrganizationDetail>(`/admin/organizations/${encodeURIComponent(id)}`, { signal })

export const listAdminOrganizationMembers = (
  api: ApiRequest,
  id: string,
  params: { page: number; pageSize: number },
  signal?: AbortSignal,
) => api<Page<OrganizationMember>>(`/admin/organizations/${encodeURIComponent(id)}/members${query(params)}`, { signal })

export const updateAdminOrganization = (
  api: ApiRequest,
  id: string,
  input: { name?: string; slug?: string; description?: string | null; websiteUrl?: string | null },
) => api<AdminOrganization>(`/admin/organizations/${encodeURIComponent(id)}`, json('PATCH', input))

export const changeOrganizationOwner = (api: ApiRequest, id: string, ownerIdentifier: string | null) =>
  api<AdminOrganization>(`/admin/organizations/${id}/owner`, json('PATCH', { ownerIdentifier }))

export const archiveOrganization = (api: ApiRequest, id: string) =>
  api<AdminOrganization>(`/admin/organizations/${id}/archive`, { method: 'POST' })

export const restoreOrganization = (api: ApiRequest, id: string) =>
  api<AdminOrganization>(`/admin/organizations/${id}/restore`, { method: 'POST' })

export const listAdminRequests = (
  api: ApiRequest,
  params: { page: number; pageSize: number; q?: string; status?: OrganizationRequestStatus; sort?: 'newest' | 'oldest' },
  signal?: AbortSignal,
) => api<AdminRequestPage>(`/admin/organization-requests${query(params)}`, { signal })

export const getAdminOrganizationRequest = (api: ApiRequest, id: string, signal?: AbortSignal) =>
  api<AdminOrganizationRequest>(`/admin/organization-requests/${encodeURIComponent(id)}`, { signal })

export const approveOrganizationRequest = (
  api: ApiRequest,
  id: string,
  input: Partial<OrganizationFormInput> & { reviewNote?: string | null },
) => api<AdminOrganizationRequest>(`/admin/organization-requests/${id}/approve`, json('POST', input))

export const rejectOrganizationRequest = (api: ApiRequest, id: string, reviewNote: string | null) =>
  api<AdminOrganizationRequest>(`/admin/organization-requests/${id}/reject`, json('POST', { reviewNote }))

// ----- Hàm thuần (có unit test) -----

export type RequestFormValues = Record<'fullName' | 'workplace' | 'position' | 'phone' | 'wish', string>

export const REQUEST_LIMITS = { fullName: 100, workplace: 200, position: 100, phone: 20, wish: 2000 } as const

export function toRequestInput(values: RequestFormValues): NewRequestInput {
  return {
    fullName: values.fullName.trim(),
    workplace: values.workplace.trim(),
    position: values.position.trim(),
    phoneNumber: values.phone.trim(),
    motivation: values.wish.trim(),
  }
}

export type RequestFieldError = 'required' | 'phoneInvalid' | null

export function validateRequestField(name: keyof RequestFormValues, rawValue: string): RequestFieldError {
  const value = rawValue.trim()
  if (!value) return 'required'
  if (name === 'phone') {
    const digits = value.replace(/\D/g, '').length
    if (!/^\+?[0-9 .-]+$/.test(value) || digits < 9 || digits > 15) return 'phoneInvalid'
  }
  return null
}

export type RequestErrorKind = 'network' | 'session' | 'pending' | 'rateLimit' | 'validation' | 'generic'

export function classifyRequestError(caught: unknown): RequestErrorKind {
  if (!(caught instanceof ApiError)) return 'network'
  if (caught.status === 401) return 'session'
  if (caught.status === 409) return 'pending'
  if (caught.status === 429) return 'rateLimit'
  if (caught.status === 400) return 'validation'
  return 'generic'
}

export function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.message ? caught.message : fallback
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
