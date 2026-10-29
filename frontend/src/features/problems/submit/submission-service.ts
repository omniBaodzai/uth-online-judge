export type SubmissionPayload = {
  problemCode: string
  language: string
  sourceCode: string
}

export type SubmissionResult = { id: string; status: string; submittedAt: string }

export type SubmissionTestResult = {
  position: number
  status: string | null
  executionTimeMs: number | null
  memoryUsedKb: number | null
  pointsAwarded: number
  maxPoints: number
}

export type SubmissionDetails = {
  id: string
  problemCode: string
  problemTitle: string
  username: string | null
  language: string
  sourceCode: string
  status: string
  scoringEnabled: boolean
  score: number
  maxScore: number
  cumulativeScore: number
  cumulativeMaxScore: number
  executionTimeMs: number | null
  memoryUsedKb: number | null
  submittedAt: string
  judgedAt: string | null
  testResults: SubmissionTestResult[]
}

export type ProblemSubmissionListItem = {
  id: string
  status: string
  language: string
  scoringEnabled: boolean
  score: number | null
  maxScore: number | null
  executionTimeMs: number | null
  memoryUsedKb: number | null
  submittedAt: string
}

export type ProblemSubmissionPage = {
  problem: {
    code: string
    title: string
    scoringEnabled: boolean
    cumulativeScore: number
    totalTestCases: number
  }
  items: ProblemSubmissionListItem[]
  total: number
  statistics: {
    total: number
    accepted: number
    wrongAnswer: number
    compilationError: number
    acceptanceRate: number
    verdictCounts: Record<string, number>
    languages: string[]
  }
}

export type ProblemSubmissionFilters = {
  page: number
  pageSize: number
  status?: string
  language?: string
}

export type GlobalSubmissionItem = {
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

export type GlobalSubmissionPage = {
  items: GlobalSubmissionItem[]
  total: number
  page: number
  pageSize: number
  statistics: {
    total: number
    accepted: number
    acceptanceRate: number
    verdictCounts: Record<string, number>
  }
  filters: { languages: string[] }
  problem: { code: string; title: string } | null
}

export type GlobalSubmissionFilters = {
  page: number
  pageSize: number
  q?: string
  status?: string
  language?: string
  problemCode?: string
  userId?: string
}

export type BestSubmissionPage = {
  problem: { code: string; title: string }
  language: string | null
  languages: string[]
  items: Array<GlobalSubmissionItem & { rank: number }>
  total: number
  page: number
  pageSize: number
  statistics: {
    total: number
    accepted: number
    acceptanceRate: number
    verdictCounts: Record<string, number>
  }
}

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>

// Gửi bài lên backend để xếp hàng chấm bất đồng bộ.
export function submitSolution(request: RequestFn, payload: SubmissionPayload): Promise<SubmissionResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  return request<SubmissionResult>('/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout))
}

export function getSubmissionDetails(
  request: RequestFn,
  submissionId: string,
): Promise<SubmissionDetails> {
  return request<SubmissionDetails>(`/submissions/${encodeURIComponent(submissionId)}`)
}

export function getGlobalSubmissions(
  request: RequestFn,
  filters: GlobalSubmissionFilters,
  signal?: AbortSignal,
): Promise<GlobalSubmissionPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })
  if (filters.q) query.set('q', filters.q)
  if (filters.status) query.set('status', filters.status)
  if (filters.language) query.set('language', filters.language)
  if (filters.problemCode) query.set('problemCode', filters.problemCode)
  if (filters.userId) query.set('userId', filters.userId)

  return request<GlobalSubmissionPage>(`/submissions?${query.toString()}`, { signal })
}

export function getBestSubmissions(
  request: RequestFn,
  problemCode: string,
  filters: { page: number; pageSize: number; q?: string; language?: string },
  signal?: AbortSignal,
): Promise<BestSubmissionPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })
  if (filters.q) query.set('q', filters.q)
  if (filters.language) query.set('language', filters.language)

  return request<BestSubmissionPage>(
    `/submissions/best/${encodeURIComponent(problemCode)}?${query.toString()}`,
    { signal },
  )
}

export function getMyProblemSubmissions(
  request: RequestFn,
  problemCode: string,
  filters: ProblemSubmissionFilters,
): Promise<ProblemSubmissionPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })
  if (filters.status) query.set('status', filters.status)
  if (filters.language) query.set('language', filters.language)

  return request<ProblemSubmissionPage>(
    `/submissions/mine/${encodeURIComponent(problemCode)}?${query.toString()}`,
  )
}
