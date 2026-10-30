import type { ProblemStatus } from './data'
import type { ProblemDetailResponse } from './api'
import { resolveIllustrationUrl } from '../auth/api'

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
  scoringEnabled: boolean
  description: string
  input: string
  constraints: string
  output: string
  illustrationUrl: string | null
  illustrationWidth: number
  illustrationAspectRatio: 'auto' | '16:9' | '4:3' | '1:1' | '3:2'
  illustrationAlignment: 'left' | 'center' | 'right'
  examples: ProblemExample[]
  points: number
  timeLimit: string
  memoryLimit: string
  author: string | null
  topics: string[]
  languages: string[]
  languageOptions: { slug: string; name: string }[]
}

export const reportTypes = [
  'Đề bài sai hoặc thiếu thông tin',
  'Dữ liệu kiểm thử không chính xác',
  'Lỗi hiển thị',
  'Vấn đề khác',
]

export function formatTimeLimit(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000} giây` : `${ms} ms`
}

export function toProblemDetail(data: ProblemDetailResponse): ProblemDetail {
  return {
    code: data.code,
    title: data.title,
    status: data.status,
    hasSolution: data.hasSolution,
    scoringEnabled: data.scoringEnabled,
    description: data.statement,
    input: data.inputDescription ?? '',
    constraints: data.constraints ?? '',
    output: data.outputDescription ?? '',
    illustrationUrl: resolveIllustrationUrl(data.illustrationUrl),
    illustrationWidth: data.illustrationWidth ?? 100,
    illustrationAspectRatio: data.illustrationAspectRatio ?? 'auto',
    illustrationAlignment: data.illustrationAlignment ?? 'center',
    examples: data.examples,
    points: data.points,
    timeLimit: formatTimeLimit(data.timeLimitMs),
    memoryLimit: `${data.memoryLimitMb} MB`,
    author: data.author,
    topics: data.tags.map((tag) => tag.name),
    languages: data.languages.map((language) => language.name),
    languageOptions: data.languages.map(({ slug, name }) => ({ slug, name })),
  }
}
