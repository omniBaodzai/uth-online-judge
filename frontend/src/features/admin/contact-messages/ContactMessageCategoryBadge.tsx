import type { ContactMessage } from './contact-messages.types'
import pageStyles from './AdminContactMessagesPage.module.css'


export function ContactMessageCategoryBadge({ category }: { category: ContactMessage['category'] }) {
  if (category !== 'PROBLEM_REPORT') return null
  return <span className={pageStyles.categoryBadge}>Báo cáo vấn đề</span>
}
