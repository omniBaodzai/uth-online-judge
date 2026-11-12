export type NotificationType = 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'DISCUSSION_REPLY' | 'PROBLEM_REPLY'

export type UserNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
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
}
