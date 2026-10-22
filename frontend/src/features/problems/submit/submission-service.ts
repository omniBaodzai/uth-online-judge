import type { LanguageId } from './languages'

export type SubmissionPayload = {
  problemCode: string
  language: LanguageId
  sourceCode: string
}

export type SubmissionResult = { status: 'not-implemented' }

// Điểm tích hợp API nộp bài. Hiện chưa có endpoint nên không gửi request nào.
export async function submitSolution(payload: SubmissionPayload): Promise<SubmissionResult> {
  void payload
  await new Promise((resolve) => window.setTimeout(resolve, 600))
  return { status: 'not-implemented' }
}
