export type ContactMessageStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'

export type ContactMessage = {
  id: string
  ownerUserId?: string
  fullName: string
  email: string
  subject: string
  message: string
  status: ContactMessageStatus
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
  page: number
  pageSize: 10 | 20 | 50
}

export type ContactMessageRouteState = {
  listState?: ContactMessageListState
}
