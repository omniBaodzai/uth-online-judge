import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/ui/toast-context'
import { useCommunityRequest } from './api'
import { resolveAvatarUrl } from '../auth/api'
import UserAvatar from '../profile/components/UserAvatar'
import { formatDateTime } from './format'
import { decideGuestAction } from './guest-actions'
import { ReactionBar } from './ReactionBar'
import type { ReactionSummary } from './reactions'
import { communityText } from './translate'
import { errorMessage } from './useAsync'
import { CommentText } from './CommentText'
import { isValidCommentUsername, publicCommentProfilePath } from './comment-user'
import type { CommentReplyController } from './useCommentReply'
import styles from './community.module.css'
import { discussionCommentElementId } from './discussion-comment-navigation'

export type CommentNode = {
  id: string
  parentId: string | null
  isDeleted: boolean
  authorName: string
  authorUsername?: string | null
  avatarUrl?: string | null
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
  supportsIdempotencyKey?: boolean
}

type CommentItemProps = {
  comment: CommentNode
  paths: CommentPaths
  locked?: boolean
  isReply?: boolean
  targetCommentId?: string | null
  targetElementId?: string | null
  highlightedCommentId?: string | null
  parentAuthorUsername?: string | null
  replyController: CommentReplyController
  request: ReturnType<typeof useCommunityRequest>['request']
  onChanged: () => void
}

export function CommentItem({
  comment,
  paths,
  locked = false,
  isReply = false,
  targetCommentId = null,
  targetElementId = null,
  highlightedCommentId = null,
  parentAuthorUsername = null,
  replyController,
  request,
  onChanged,
}: CommentItemProps) {
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, language, key, vi, en, values)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const replyIdempotencyKeyRef = useRef<{ content: string; key: string } | null>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const replyButtonRef = useRef<HTMLButtonElement>(null)
  const replying = replyController.activeCommentId === comment.id
  const replyDraft = replyController.getDraft(comment.id)
  const resolvedAuthorUsername = comment.authorUsername === undefined
    ? comment.authorName
    : comment.authorUsername
  const mentionUsername = isValidCommentUsername(resolvedAuthorUsername)
    ? resolvedAuthorUsername
    : null
  const profilePath = publicCommentProfilePath(mentionUsername)
  const avatarSource = resolveAvatarUrl(comment.avatarUrl)
  const avatarLabel = text(
    'viewCommentAuthorProfile',
    'Mở hồ sơ của {{name}}',
    'Open {{name}}’s profile',
    { name: resolvedAuthorUsername ?? comment.authorName },
  )

  useLayoutEffect(() => {
    if (!replying) return
    const input = replyInputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(replyController.focusOffset, replyController.focusOffset)
  }, [replyController.focusOffset, replying])

  function startReply() {
    const decision = decideGuestAction({ isReady, isAuthenticated }, 'reply', text('guestReply', 'Bạn cần đăng nhập để trả lời bình luận.', 'Sign in to reply.'))
    if (decision.kind === 'toast') showToast(decision.message)
    else if (decision.kind === 'proceed') replyController.startReply(comment.id, mentionUsername)
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
    const pending = replyIdempotencyKeyRef.current
    const idempotencyKey = paths.supportsIdempotencyKey
      ? pending?.content === content
        ? pending.key
        : crypto.randomUUID()
      : null
    if (idempotencyKey) replyIdempotencyKeyRef.current = { content, key: idempotencyKey }
    try {
      await request(paths.create, {
        method: 'POST',
        ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
        body: JSON.stringify({ content, parentId: comment.id }),
      })
      replyIdempotencyKeyRef.current = null
      replyController.completeReply(comment.id)
      replyButtonRef.current?.focus()
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
          targetCommentId={targetCommentId}
          targetElementId={targetElementId}
          highlightedCommentId={highlightedCommentId}
          parentAuthorUsername={mentionUsername}
          replyController={replyController}
          request={request}
          onChanged={onChanged}
        />
      ))}
    </div>
  ) : null

  if (comment.isDeleted) {
    return (
      <div
        id={comment.id === targetCommentId ? targetElementId ?? discussionCommentElementId(comment.id) : undefined}
        className={`${styles.comment} ${isReply ? styles.reply : ''} ${comment.id === highlightedCommentId ? styles.commentTargetHighlight : ''}`}
        tabIndex={comment.id === targetCommentId ? -1 : undefined}
      >
        <p className={styles.deletedComment}>{text('commentDeleted', 'Bình luận đã bị xóa', 'Comment deleted')}</p>
        {replyList}
      </div>
    )
  }

  return (
    <div
      id={comment.id === targetCommentId ? targetElementId ?? discussionCommentElementId(comment.id) : undefined}
      className={`${styles.comment} ${isReply ? styles.reply : ''} ${comment.id === highlightedCommentId ? styles.commentTargetHighlight : ''}`}
      tabIndex={comment.id === targetCommentId ? -1 : undefined}
    >
      <div className={styles.commentIdentity}>
        {profilePath ? (
          <Link className={styles.commentAvatarLink} to={profilePath} aria-label={avatarLabel}>
            <UserAvatar source={avatarSource} username={comment.authorName} />
          </Link>
        ) : (
          <UserAvatar source={avatarSource} username={comment.authorName} />
        )}
        <div className={styles.commentAuthorDetails}>
          <div className={styles.commentHead}>
            <strong>
              {profilePath ? (
                <Link className={styles.commentProfileLink} to={profilePath}>{comment.authorName}</Link>
              ) : comment.authorName}
            </strong>
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
            <CommentText content={comment.content} replyToUsername={parentAuthorUsername} />
          )}
          {!editing ? (
            <div className={styles.commentTools}>
              <ReactionBar summary={comment.reactions} path={paths.reaction(comment.id)} small />
              {!locked ? (
                <button ref={replyButtonRef} className={styles.linkButton} type="button" onClick={startReply}>{text('reply', 'Trả lời', 'Reply')}</button>
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
                ref={replyInputRef}
                className={styles.textarea}
                aria-label={text('replyTo', 'Trả lời {{name}}', 'Reply to {{name}}', { name: comment.authorName })}
                value={replyDraft}
                maxLength={5000}
                rows={3}
                onChange={(event) => replyController.updateDraft(comment.id, event.target.value)}
              />
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? text('sending', 'Đang gửi…', 'Sending…') : text('sendReply', 'Gửi phản hồi', 'Post reply')}</button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    replyController.cancelReply(comment.id)
                    replyButtonRef.current?.focus()
                  }}
                >
                  {text('cancel', 'Hủy', 'Cancel')}
                </button>
              </div>
            </form>
          ) : null}
          {replyList}
        </div>
      </div>
    </div>
  )
}
