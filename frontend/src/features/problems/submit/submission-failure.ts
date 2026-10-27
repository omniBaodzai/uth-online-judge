export function describeSubmissionFailure(error: unknown): {
  message: string
  submissionId?: string
} {
  if (error instanceof Error) {
    const status = 'status' in error ? error.status : undefined
    const submissionId =
      'submissionId' in error && typeof error.submissionId === 'string'
        ? error.submissionId
        : undefined
    if (submissionId) return { message: error.message, submissionId }
    if (status === 0) {
      return {
        message:
          'Chưa nhận được xác nhận từ máy chủ. Bài nộp có thể đã được lưu; hãy kiểm tra danh sách bài nộp trước khi gửi lại.',
      }
    }
    if (typeof status === 'number') return { message: error.message }
  }
  return { message: 'Không thể gửi bài giải. Vui lòng thử lại.' }
}
