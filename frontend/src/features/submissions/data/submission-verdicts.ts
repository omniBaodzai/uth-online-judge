export const submissionVerdicts = [
  { status: 'ACCEPTED', abbr: 'AC', label: 'Accepted', color: '#2ca06a' },
  { status: 'WRONG_ANSWER', abbr: 'WA', label: 'Wrong Answer', color: '#dc5555' },
  { status: 'TIME_LIMIT_EXCEEDED', abbr: 'TLE', label: 'Time Limit Exceeded', color: '#e0a02e' },
  { status: 'MEMORY_LIMIT_EXCEEDED', abbr: 'MLE', label: 'Memory Limit Exceeded', color: '#8f67d8' },
  { status: 'RUNTIME_ERROR', abbr: 'RE', label: 'Runtime Error', color: '#ee8450' },
  { status: 'COMPILATION_ERROR', abbr: 'CE', label: 'Compilation Error', color: '#8e9b9e' },
  { status: 'QUEUED', abbr: 'Q', label: 'Đang chờ', color: '#2e8eaa' },
  { status: 'RUNNING', abbr: 'RUN', label: 'Đang chấm', color: '#2176b7' },
  { status: 'PENDING', abbr: 'PEND', label: 'Chờ xử lý', color: '#b4c2c3' },
  { status: 'INTERNAL_ERROR', abbr: 'IE', label: 'Lỗi hệ thống', color: '#8d4b67' },
] as const

export type SubmissionVerdictDistributionItem = {
  status: string
  abbr: string
  label: string
  color: string
  count: number
  percentage: number
}

export function getSubmissionVerdictDistribution(
  verdictCounts: Record<string, number>,
  total: number,
): SubmissionVerdictDistributionItem[] {
  if (total <= 0) return []

  const toItem = (status: string, abbr: string, label: string, color: string, count: number) => ({
    status,
    abbr,
    label,
    color,
    count,
    percentage: (count / total) * 100,
  })
  const counts = Object.entries(verdictCounts).filter(([, count]) => Number.isFinite(count) && count > 0)
  const known = new Set<string>(submissionVerdicts.map(({ status }) => status))

  const items: SubmissionVerdictDistributionItem[] = submissionVerdicts.flatMap(
    ({ status, abbr, label, color }) => {
      const count = verdictCounts[status] ?? 0
      return count > 0 && Number.isFinite(count) ? [toItem(status, abbr, label, color, count)] : []
    },
  )

  // Trạng thái chưa có trong bảng và phần chênh lệch đều gom vào "Khác" để không mất bài nộp nào.
  const unknownCount = counts
    .filter(([status]) => !known.has(status))
    .reduce((sum, [, count]) => sum + count, 0)
  const classified = items.reduce((sum, item) => sum + item.count, 0)
  const otherCount = Math.max(unknownCount + Math.max(total - classified - unknownCount, 0), 0)
  if (otherCount > 0) items.push(toItem('OTHER', '?', 'Khác', '#a5aeb0', otherCount))

  return items
}
