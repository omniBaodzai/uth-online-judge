import { useCallback } from 'react'
import { request as publicRequest } from '../auth/api'
import { useAuth } from '../auth/useAuth'

export type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number }

export type NewsListItem = {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  authorName: string
  publishedAt: string | null
}

export type NewsStatus = 'DRAFT' | 'PUBLISHED'

export type NewsArticle = NewsListItem & {
  content: string
  status: NewsStatus
  createdAt: string
  updatedAt: string
}

export type NewsInput = {
  title: string
  slug?: string
  category: string
  summary: string
  content: string
}

export type DiscussionListItem = {
  id: string
  title: string
  summary: string
  authorName: string
  createdAt: string
  replies: number
  isLocked: boolean
}

export type DiscussionDetail = Omit<DiscussionListItem, 'summary'> & {
  content: string
  updatedAt: string
  canEdit: boolean
  canDelete: boolean
  canModerate: boolean
}

export type DiscussionComment = {
  id: string
  discussionId: string
  authorName: string
  content: string
  createdAt: string
  updatedAt: string
  canEdit: boolean
  canDelete: boolean
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

type Requester = <T>(path: string, init?: RequestInit) => Promise<T>

// Khách dùng request công khai; người đã đăng nhập dùng request có token để nhận cờ quyền (canEdit...).
export function useCommunityRequest(): { request: Requester; isReady: boolean; isAuthenticated: boolean } {
  const { request: authRequest, accessToken, isLoading } = useAuth()
  const request = useCallback<Requester>(
    (path, init) => (accessToken ? authRequest(path, init) : publicRequest(path, init)),
    [accessToken, authRequest],
  )
  return { request, isReady: !isLoading, isAuthenticated: Boolean(accessToken) }
}
