import type {
  ContactMessage,
  ContactMessageCategory,
  ContactMessageStatus,
  ContactReply,
} from '../admin/contact-messages/contact-messages.types'
import { ApiError, request } from '../auth/api'

export type ContactApiRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export type CreateContactMessageResponse = {
  id: string
  status: ContactMessageStatus
  createdAt: string
  trackingAvailable: boolean
}

export type ContactMessageResponse = {
  id: string
  userId: string | null
  username?: string | null
  fullName: string
  email: string
  subject: string
  content: string
  status: ContactMessageStatus
  category?: ContactMessageCategory
  reportType?: string | null
  problemId?: string | null
  problemCode?: string | null
  problemTitle?: string | null
  createdAt: string
  updatedAt: string
}

export type ContactReplyResponse = {
  id: string
  contactMessageId: string
  senderUserId: string | null
  senderRole: 'ADMIN' | 'USER'
  senderName: string
  content: string
  createdAt: string
}

export type ContactMessageDetailsResponse = ContactMessageResponse & {
  replies: ContactReplyResponse[]
}

export type AdminContactMessageListResponse = {
  items: ContactMessageResponse[]
  total: number
  page: number
  pageSize: number
  statistics: {
    total: number
    NEW: number
    IN_PROGRESS: number
    RESOLVED: number
  }
}

export type ContactReplyResponseEnvelope = {
  reply: ContactReplyResponse
  created: boolean
}

export type UserNotificationsResponse = {
  items: Array<{
    id: string
    type: 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'DISCUSSION_REPLY' | 'PROBLEM_REPLY'
    title: string
    content: string
    contactMessageId: string
    actorUserId?: string | null
    actorName?: string | null
    sourceType?: 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT'
    sourceId?: string
    targetType?: 'CONTACT_MESSAGE' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT'
    targetId?: string | null
    targetAvailable?: boolean
    metadata?: Record<string, string>
    isRead: boolean
    createdAt: string
    readAt: string | null
  }>
  total: number
  unreadCount: number
  page: number
  pageSize: number
}

export function toContactMessage(record: ContactMessageResponse): ContactMessage {
  return {
    id: record.id,
    ownerUserId: record.userId ?? undefined,
    username: record.username ?? undefined,
    fullName: record.fullName,
    email: record.email,
    subject: record.subject,
    message: record.content,
    status: record.status,
    category: record.category ?? 'CONTACT',
    reportType: record.reportType ?? undefined,
    problemId: record.problemId ?? undefined,
    problemCode: record.problemCode ?? undefined,
    problemTitle: record.problemTitle ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function toContactReply(record: ContactReplyResponse): ContactReply {
  return {
    id: record.id,
    contactMessageId: record.contactMessageId,
    senderType: record.senderRole,
    senderName: record.senderName,
    content: record.content,
    createdAt: record.createdAt,
  }
}

export function submitContactMessage(
  apiRequest: ContactApiRequest | typeof request,
  input: { fullName: string; email: string; subject: string; content: string },
  signal?: AbortSignal,
): Promise<CreateContactMessageResponse> {
  return apiRequest<CreateContactMessageResponse>('/contact-messages', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  })
}

export function submitProblemReport(
  apiRequest: ContactApiRequest,
  problemCode: string,
  input: { reportType: string; content: string },
  signal?: AbortSignal,
): Promise<{ id: string; status: ContactMessageStatus; createdAt: string }> {
  return apiRequest(`/problems/${encodeURIComponent(problemCode)}/reports`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  })
}

export function getMyContactMessage(
  apiRequest: ContactApiRequest,
  id: string,
  signal?: AbortSignal,
): Promise<ContactMessageDetailsResponse> {
  return apiRequest<ContactMessageDetailsResponse>(
    `/my/contact-messages/${encodeURIComponent(id)}`,
    { signal },
  )
}

export function replyToMyContactMessage(
  apiRequest: ContactApiRequest,
  id: string,
  content: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ContactReplyResponseEnvelope> {
  return apiRequest<ContactReplyResponseEnvelope>(
    `/my/contact-messages/${encodeURIComponent(id)}/replies`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ content }),
      signal,
    },
  )
}

export function listMyNotifications(
  apiRequest: ContactApiRequest,
  signal?: AbortSignal,
): Promise<UserNotificationsResponse> {
  return apiRequest<UserNotificationsResponse>(
    '/my/notifications?page=1&pageSize=50',
    { signal },
  )
}

export function getMyUnreadNotificationCount(
  apiRequest: ContactApiRequest,
  signal?: AbortSignal,
): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/my/notifications/unread-count', { signal })
}

export function markMyNotificationRead(
  apiRequest: ContactApiRequest,
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; isRead: boolean }> {
  return apiRequest<{ id: string; isRead: boolean }>(
    `/my/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH', signal },
  )
}

export function markAllMyNotificationsRead(
  apiRequest: ContactApiRequest,
  signal?: AbortSignal,
): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>('/my/notifications/read-all', {
    method: 'PATCH',
    signal,
  })
}

export async function listAdminContactMessages(
  apiRequest: ContactApiRequest,
  query: {
    page: number
    pageSize: number
    q?: string
    status?: ContactMessageStatus
    category?: ContactMessageCategory
  },
  signal?: AbortSignal,
): Promise<AdminContactMessageListResponse> {
  const search = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.q) search.set('q', query.q)
  if (query.status) search.set('status', query.status)
  if (query.category) search.set('category', query.category)
  return apiRequest<AdminContactMessageListResponse>(
    `/admin/contact-messages?${search.toString()}`,
    { signal },
  )
}

export async function getAdminContactMessage(
  apiRequest: ContactApiRequest,
  id: string,
  signal?: AbortSignal,
): Promise<ContactMessageDetailsResponse> {
  return apiRequest<ContactMessageDetailsResponse>(
    `/admin/contact-messages/${encodeURIComponent(id)}`,
    { signal },
  )
}

export async function updateAdminContactMessageStatus(
  apiRequest: ContactApiRequest,
  id: string,
  status: ContactMessageStatus,
  signal?: AbortSignal,
): Promise<ContactMessageResponse> {
  return apiRequest<ContactMessageResponse>(
    `/admin/contact-messages/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal,
    },
  )
}

export async function replyToAdminContactMessage(
  apiRequest: ContactApiRequest,
  id: string,
  content: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ContactReplyResponseEnvelope> {
  return apiRequest<ContactReplyResponseEnvelope>(
    `/admin/contact-messages/${encodeURIComponent(id)}/replies`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ content }),
      signal,
    },
  )
}

export function getContactApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
    return error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}
