import { submissionVerdicts } from './data/submission-verdicts'

export type Submission = {
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

export const submissionPageSizes = [10, 20, 50]

// Màu badge ở bảng; tên, viết tắt và màu biểu đồ lấy từ danh sách kết quả dùng chung.
const badgeColors: Record<string, { color: string; background: string }> = {
  ACCEPTED: { color: '#14693f', background: '#e3f6ec' },
  WRONG_ANSWER: { color: '#a12626', background: '#fde7e7' },
  TIME_LIMIT_EXCEEDED: { color: '#8a5200', background: '#fff0d6' },
  MEMORY_LIMIT_EXCEEDED: { color: '#5b3ea8', background: '#ece6fa' },
  RUNTIME_ERROR: { color: '#9c3a00', background: '#fde9dc' },
  COMPILATION_ERROR: { color: '#455a5c', background: '#e8eeee' },
  QUEUED: { color: '#14566b', background: '#e0f1f6' },
  RUNNING: { color: '#134f80', background: '#e1eefa' },
  PENDING: { color: '#455a5c', background: '#eef2f2' },
  INTERNAL_ERROR: { color: '#6e2a45', background: '#f6e6ed' },
}
const fallbackBadge = { color: '#455a5c', background: '#eef2f2' }

export type VerdictBadge = { abbr: string; name: string; color: string; background: string }

export function getVerdictBadge(status: string): VerdictBadge {
  const verdict = submissionVerdicts.find((item) => item.status === status)
  const colors = badgeColors[status] ?? fallbackBadge
  return { abbr: verdict?.abbr ?? status, name: verdict?.label ?? status, ...colors }
}

export const verdictFilterOptions = submissionVerdicts.map(({ status, abbr, label }) => ({
  value: status,
  label: `${abbr} — ${label}`,
}))

export function formatExecutionTime(ms: number | null): string {
  return ms === null || !Number.isFinite(ms) ? '—' : `${ms} ms`
}

// Backend lưu bộ nhớ theo KB.
export function formatMemory(kb: number | null): string {
  return kb === null || !Number.isFinite(kb) ? '—' : `${(kb / 1024).toFixed(1)} MB`
}
