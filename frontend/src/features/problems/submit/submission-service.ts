import type { LanguageId } from './languages'

export type SubmissionPayload = {
  problemCode: string
  language: LanguageId
  sourceCode: string
}

export type SubmissionResult = { id: string; status: string; submittedAt: string }

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>

// Gửi bài lên backend. Bài chỉ được ghi nhận ở trạng thái PENDING, chưa được chấm.
export function submitSolution(request: RequestFn, payload: SubmissionPayload): Promise<SubmissionResult> {
  return request<SubmissionResult>('/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
