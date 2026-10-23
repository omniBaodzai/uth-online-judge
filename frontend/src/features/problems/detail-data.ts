import type { ProblemStatus } from './data'
import type { ProblemDetailResponse } from './api'

export type ProblemExample = {
  input: string
  output: string
}

// Dạng hiển thị của trang chi tiết/gửi bài, được dựng từ phản hồi của API.
export type ProblemDetail = {
  code: string
  title: string
  status: ProblemStatus
  hasSolution: boolean
  description: string[]
  input: string[]
  constraints: string[]
  output: string[]
  examples: ProblemExample[]
  points: number
  timeLimit: string
  memoryLimit: string
  author: string | null
  topics: string[]
  languages: string[]
}

export const reportTypes = [
  'Đề bài sai hoặc thiếu thông tin',
  'Dữ liệu kiểm thử không chính xác',
  'Lỗi hiển thị',
  'Vấn đề khác',
]

function paragraphs(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function lines(text: string | null): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function formatTimeLimit(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000} giây` : `${ms} ms`
}

export function toProblemDetail(data: ProblemDetailResponse): ProblemDetail {
  return {
    code: data.code,
    title: data.title,
    status: data.status,
    hasSolution: data.hasSolution,
    description: paragraphs(data.statement),
    input: paragraphs(data.inputDescription),
    constraints: lines(data.constraints),
    output: paragraphs(data.outputDescription),
    examples: data.examples,
    points: data.points,
    timeLimit: formatTimeLimit(data.timeLimitMs),
    memoryLimit: `${data.memoryLimitMb} MB`,
    author: data.author,
    topics: data.tags.map((tag) => tag.name),
    languages: data.languages.map((language) => language.name),
  }
}
