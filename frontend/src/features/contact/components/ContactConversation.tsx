import { Headset, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../community/format'
import type { ContactReply } from '../../admin/contact-messages/contact-messages.types'
import styles from './ContactConversation.module.css'

type ContactConversationProps = {
  replies: ContactReply[]
  viewer: 'user' | 'admin'
  emptyMessage: string
}

export function ContactConversation({ replies, viewer, emptyMessage }: ContactConversationProps) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const orderedReplies = [...replies].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )

  if (orderedReplies.length === 0) {
    return <p className={styles.emptyState}>{emptyMessage}</p>
  }

  return (
    <ol className={styles.timeline} aria-label={t('contactConversationMessages')}>
      {orderedReplies.map((reply) => {
        const isAdmin = reply.senderType === 'ADMIN'
        const senderLabel = isAdmin
          ? viewer === 'user' ? t('contactSupportTeam') : t('contactAdministrator')
          : viewer === 'user' ? t('you') : reply.senderName

        return (
          <li
            className={`${styles.item} ${isAdmin ? styles.adminItem : styles.userItem}`}
            key={reply.id}
          >
            <article className={styles.message}>
              <header className={styles.messageHeader}>
                <span className={styles.sender}>
                  {isAdmin
                    ? <Headset size={16} aria-hidden="true" />
                    : <UserRound size={16} aria-hidden="true" />}
                  <strong>{senderLabel || t('contactUser')}</strong>
                </span>
                <span className={styles.senderType}>{isAdmin ? t('contactAdministrator') : t('contactUser')}</span>
              </header>
              <p>{reply.content}</p>
              <time dateTime={reply.createdAt}>{formatDateTime(reply.createdAt, locale)}</time>
            </article>
          </li>
        )
      })}
    </ol>
  )
}

export function ContactMockStorageNotice({ message }: { message: string | null }) {
  if (!message) return null
  return <p className={styles.storageNotice} role="alert">{message}</p>
}
