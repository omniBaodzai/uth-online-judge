export type NotificationType = 'CONTACT_REPLY'

export type UserNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  contactMessageId: string
  isRead: boolean
  createdAt: string
}
