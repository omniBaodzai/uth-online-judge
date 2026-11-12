import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { publicCommentProfilePath } from './comment-user'
import styles from './community.module.css'

const mentionPattern = /(^|[^A-Za-z0-9._-])(@[A-Za-z0-9._-]{3,32})(?![A-Za-z0-9._-])/g

export function CommentText({
  content,
  replyToUsername,
}: {
  content: string
  replyToUsername?: string | null
}) {
  const nodes: ReactNode[] = []
  let cursor = 0
  const replyToPath = publicCommentProfilePath(replyToUsername)

  for (const match of content.matchAll(mentionPattern)) {
    const precedingText = match[1] ?? ''
    const mention = match[2]
    if (!mention) continue

    const mentionStart = match.index + precedingText.length
    nodes.push(content.slice(cursor, mentionStart))
    const isKnownReplyTarget = replyToPath
      && mention.slice(1).toLocaleLowerCase() === replyToUsername?.toLocaleLowerCase()
    nodes.push(isKnownReplyTarget ? (
      <Link
        className={styles.commentMention}
        key={`${mentionStart}-${mention}`}
        to={replyToPath}
      >
        {mention}
      </Link>
    ) : (
      <span className={styles.commentMention} key={`${mentionStart}-${mention}`}>
        {mention}
      </span>
    ))
    cursor = mentionStart + mention.length
  }

  if (nodes.length === 0) return <p className={styles.plainText}>{content}</p>
  nodes.push(content.slice(cursor))
  return <p className={styles.plainText}>{nodes}</p>
}
