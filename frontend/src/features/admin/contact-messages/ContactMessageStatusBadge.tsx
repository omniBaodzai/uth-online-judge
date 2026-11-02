import type { ContactMessageStatus } from './contact-messages.types'
import pageStyles from './AdminContactMessagesPage.module.css'

const statusLabels: Record<ContactMessageStatus, string> = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
}

export function ContactMessageStatusBadge({ status }: { status: ContactMessageStatus }) {
  return (
    <span className={`${pageStyles.statusBadge} ${pageStyles[`status_${status.toLowerCase()}`]}`}>
      {statusLabels[status]}
    </span>
  )
}
