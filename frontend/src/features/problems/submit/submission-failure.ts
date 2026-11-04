const defaultMessages: Record<string, string> = {
  problemEditorSubmitFailureOffline:
    'Mất kết nối trước khi nhận xác nhận. Bài nộp có thể đã được lưu; hãy kiểm tra danh sách bài nộp trước khi gửi lại.',
  problemEditorSubmitFailureUnknown:
    'Không nhận được xác nhận hợp lệ từ máy chủ. Hãy kiểm tra bài nộp trước khi gửi lại.',
}

export function describeSubmissionFailure(
  error: unknown,
  translate: (key: string) => string = (key) => defaultMessages[key] ?? key,
): {
  message: string
  submissionId?: string
  outcomeUnknown: boolean
} {
  if (error instanceof Error) {
    const status = 'status' in error ? error.status : undefined
    const submissionId =
      'submissionId' in error && typeof error.submissionId === 'string'
        ? error.submissionId
        : undefined
    if (submissionId) {
      return { message: error.message, submissionId, outcomeUnknown: true }
    }
    if (status === 0) {
      return {
        message:
          translate('problemEditorSubmitFailureOffline'),
        outcomeUnknown: true,
      }
    }
    if (typeof status === 'number') {
      return { message: error.message, outcomeUnknown: status >= 500 }
    }
  }
  return {
    message: translate('problemEditorSubmitFailureUnknown'),
    outcomeUnknown: true,
  }
}
