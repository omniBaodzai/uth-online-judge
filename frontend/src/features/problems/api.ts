import { request as publicRequest } from '../auth/api'
import type { ProblemStatus } from './data'

export type Fetcher = <T>(path: string, init?: RequestInit) => Promise<T>

// Khách dùng request công khai; người dùng đã đăng nhập dùng request có token để nhận trạng thái cá nhân.
export const anonymousFetcher: Fetcher = (path, init) => publicRequest(path, init)

export type Tag = { name: string; slug: string }

export type ProblemListItem = {
  code: string
  title: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  scoringEnabled: boolean
  points: number
  acceptanceRate: number
  acCount: number
  status: ProblemStatus
  hasSolution: boolean
  publishedAt: string | null
  tags: Tag[]
}

export type ProblemListResponse = {
  items: ProblemListItem[]
  page: number
  pageSize: number
  total: number
}

export type ProblemListParams = {
  page?: number
  pageSize?: number
  search?: string
  tags?: string[]
  status?: ProblemStatus
  sort?: 'code' | 'title' | 'points' | 'difficulty' | 'publishedAt'
  order?: 'asc' | 'desc'
}

export type ProblemDetailResponse = {
  code: string
  title: string
  statement: string
  inputDescription: string | null
  outputDescription: string | null
  constraints: string | null
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  scoringEnabled: boolean
  points: number
  timeLimitMs: number
  memoryLimitMb: number
  author: string | null
  publishedAt: string | null
  status: ProblemStatus
  hasSolution: boolean
  tags: Tag[]
  examples: { input: string; output: string }[]
  languages: { slug: string; name: string; version: string | null }[]
}

export type ProblemEditorialResponse = {
  problem: { code: string; title: string }
  editorials: {
    id: string
    title: string
    language: string
    sourceCode: string
  }[]
}

export function buildListQuery(params: ProblemListParams): string {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.pageSize) search.set('pageSize', String(params.pageSize))
  if (params.search?.trim()) search.set('search', params.search.trim())
  if (params.tags?.length) search.set('tags', params.tags.join(','))
  if (params.status) search.set('status', params.status)
  if (params.sort) search.set('sort', params.sort)
  if (params.order) search.set('order', params.order)
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function fetchProblems(fetcher: Fetcher, params: ProblemListParams) {
  return fetcher<ProblemListResponse>(`/problems${buildListQuery(params)}`)
}

export function fetchTags(fetcher: Fetcher) {
  return fetcher<Tag[]>('/problems/tags')
}

export function fetchProblemDetail(fetcher: Fetcher, code: string) {
  return fetcher<ProblemDetailResponse>(`/problems/${encodeURIComponent(code)}`)
}

export function fetchProblemEditorial(fetcher: Fetcher, code: string) {
  return fetcher<ProblemEditorialResponse>(`/problems/${encodeURIComponent(code)}/solution`)
}
