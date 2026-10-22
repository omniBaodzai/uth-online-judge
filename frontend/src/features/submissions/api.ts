export type JudgeStatus = 'PENDING' | 'JUDGING' | 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE'

export type SubmissionResult = {
  id: string
  username: string | null
  problemCode: string
  sourceCode?: string
  languageId: number
  status: JudgeStatus
  executionTime: number | null
  memoryUsed: number | null
  score: number
  passedTests: number
  totalTests: number
  compileOutput: string | null
  createdAt: string
}

export type SubmissionRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export function createSubmission(
  request: SubmissionRequest,
  input: { problemCode: string; sourceCode: string; languageId: number },
) {
  return request<SubmissionResult>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getSubmission(request: SubmissionRequest, id: string) {
  return request<SubmissionResult>(`/api/submissions/${encodeURIComponent(id)}`)
}

export const isJudgingFinished = (status: JudgeStatus) => status !== 'PENDING' && status !== 'JUDGING'

export const languageNameById: Record<number, string> = {
  50: 'C17', 54: 'C++20', 62: 'Java 17', 71: 'Python 3', 51: 'C# 12', 60: 'Go 1.23', 73: 'Rust 1.82', 63: 'JavaScript',
}

export function listSubmissions(request: SubmissionRequest) {
  return request<{ items: SubmissionResult[]; total: number }>('/api/submissions?pageSize=100')
}
