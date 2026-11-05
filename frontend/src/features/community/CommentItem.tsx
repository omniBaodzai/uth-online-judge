import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/ui/toast-context'
import { useCommunityRequest } from './api'
import { formatDateTime } from './format'
import { decideGuestAction } from './guest-actions'
import { ReactionBar } from './ReactionBar'
import type { ReactionSummary } from './reactions'
import { communityText } from './translate'
import { errorMessage } from './useAsync'
import styles from './community.module.css'

export type CommentNode = {
  id: string
  parentId: string | null
  isDeleted: boolean
  authorName: string
  content: string
  createdAt: string
  updatedAt: string
  reactions: ReactionSummary
  replies: CommentNode[]
  canEdit: boolean
  canDelete: boolean
}

// Endpoint của từng nguồn bình luận (thảo luận hoặc bài tập), dùng chung một giao diện.
export type CommentPaths = {
  create: string
  item: (commentId: string) => string
  reaction: (commentId: string) => string
}

type CommentItemProps = {
  comment: CommentNode
  paths: CommentPaths
  locked?: boolean
  isReply?: boolean
  request: ReturnType<typeof useCommunityRequest>['request']
  onChanged: () => void
}

export function CommentItem({ comment, paths, locked = false, isReply = false, request, onChanged }: CommentItemProps) {
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, language, key, vi, en, values)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [replying, setReplying] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function startReply() {
    const decision = decideGuestAction({ isReady, isAuthenticated }, 'reply', text('guestReply', 'Bạn cần đăng nhập để trả lời bình luận.', 'Sign in to reply.'))
    if (decision.kind === 'toast') showToast(decision.message)
    else if (decision.kind === 'proceed') setReplying(true)
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault()
    const content = replyDraft.trim()
    if (!content) {
      setError(text('replyRequired', 'Vui lòng nhập nội dung phản hồi.', 'Please enter a reply.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await request(paths.create, {
        method: 'POST',
        body: JSON.stringify({ content, parentId: comment.id }),
      })
      setReplyDraft('')
      setReplying(false)
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.')))
    } finally {
      setBusy(false)
    }
  }

  async function mutate(init: RequestInit, after?: () => void) {
    setBusy(true)
    setError('')
    try {
      await request(paths.item(comment.id), init)
      after?.()
      onChanged()
    } catch (caught) {
      setError(errorMessage(caught, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.')))
    } finally {
      setBusy(false)
    }
  }

  const replyList = comment.replies.length > 0 ? (
    <div className={styles.replies}>
      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          paths={paths}
          locked={locked}
          isReply
          request={request}
          onChanged={onChanged}
        />
      ))}
    </div>
  ) : null

  if (comment.isDeleted) {
    return (
      <div className={`${styles.comment} ${isReply ? styles.reply : ''}`}>
        <p className={styles.deletedComment}>{text('commentDeleted', 'Bình luận đã bị xóa', 'Comment deleted')}</p>
        {replyList}
      </div>
    )
  }

  return (
    <div className={`${styles.comment} ${isReply ? styles.reply : ''}`}>
      <div className={styles.commentHead}>
        <strong>{comment.authorName}</strong>
        <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt, locale)}</time>
        {comment.updatedAt !== comment.createdAt ? <span>{text('edited', 'Đã chỉnh sửa', 'Edited')}</span> : null}
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {editing ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            void mutate({ method: 'PATCH', body: JSON.stringify({ content: draft.trim() }) }, () => setEditing(false))
          }}
        >
          <textarea className={styles.textarea} aria-label={text('editComment', 'Sửa bình luận', 'Edit comment')} value={draft} maxLength={5000} rows={3} onChange={(event) => setDraft(event.target.value)} />
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{text('save', 'Lưu', 'Save')}</button>
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setEditing(false)}>{text('cancel', 'Hủy', 'Cancel')}</button>
          </div>
        </form>
      ) : (
        <p className={styles.plainText}>{comment.content}</p>
      )}
      {!editing ? (
        <div className={styles.commentTools}>
          <ReactionBar summary={comment.reactions} path={paths.reaction(comment.id)} small />
          {!locked ? (
            <button className={styles.linkButton} type="button" onClick={startReply}>{text('reply', 'Trả lời', 'Reply')}</button>
          ) : null}
          {comment.canEdit ? <button className={styles.linkButton} type="button" onClick={() => setEditing(true)}>{text('edit', 'Chỉnh sửa', 'Edit')}</button> : null}
          {comment.canDelete ? (
            <button
              className={`${styles.linkButton} ${styles.linkDanger}`}
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(text('deleteCommentConfirmation', 'Xóa bình luận này?', 'Delete this comment?'))) void mutate({ method: 'DELETE' })
              }}
            >
              {text('delete', 'Xóa', 'Delete')}
            </button>
          ) : null}
        </div>
      ) : null}
      {replying ? (
        <form className={`${styles.form} ${styles.replyForm}`} onSubmit={submitReply} noValidate>
          <textarea
            className={styles.textarea}
            aria-label={text('replyTo', 'Trả lời {{name}}', 'Reply to {{name}}', { name: comment.authorName })}
            value={replyDraft}
            maxLength={5000}
            rows={3}
            autoFocus
            onChange={(event) => setReplyDraft(event.target.value)}
          />
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? text('sending', 'Đang gửi…', 'Sending…') : text('sendReply', 'Gửi phản hồi', 'Post reply')}</button>
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setReplying(false)}>{text('cancel', 'Hủy', 'Cancel')}</button>
          </div>
        </form>
      ) : null}
      {replyList}
    </div>
  )
}
