export type ContactMessageStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
export type ContactMessageCategory = 'CONTACT' | 'PROBLEM_REPORT'

export type ContactMessage = {
  id: string
  ownerUserId?: string
  username?: string
  fullName: string
  email: string
  subject: string
  message: string
  status: ContactMessageStatus
  category: ContactMessageCategory
  reportType?: string
  problemId?: string
  problemCode?: string
  problemTitle?: string
  createdAt: string
  updatedAt: string
}

export type ContactReplySenderType = 'ADMIN' | 'USER'

export type ContactReply = {
  id: string
  contactMessageId: string
  senderType: ContactReplySenderType
  senderName: string
  content: string
  createdAt: string
}

export type ContactMessageListState = {
  search: string
  statusFilter: ContactMessageStatus | 'all'
  categoryFilter?: ContactMessageCategory | 'all'
  page: number
  pageSize: 10 | 20 | 50
}

export type ContactMessageRouteState = {
  listState?: ContactMessageListState
}
