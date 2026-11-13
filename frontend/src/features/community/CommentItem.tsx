import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
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
  targetCommentId?: string | null
  targetElementId?: string | null
  highlightedCommentId?: string | null
  replyController: CommentReplyController
  request: ReturnType<typeof useCommunityRequest>['request']
  onChanged: () => void
}

type CommentEntry = {
  comment: CommentNode
  depth: number
  parentId: string | null
  parentMentionUsername: string | null
  verifiedParentUsername: string | null
}

type ReplyRowStyle = CSSProperties & {
  '--reply-indent': string
}

const MAX_VISUAL_REPLY_DEPTH = 3
const REPLY_INDENT_STEP_PX = 16

function mentionUsernameFor(comment: CommentNode): string | null {
  const username = comment.authorUsername === undefined ? comment.authorName : comment.authorUsername
  return isValidCommentUsername(username) ? username : null
}

function verifiedUsernameFor(comment: CommentNode): string | null {
  const username = comment.authorUsername
  return typeof username === 'string' && isValidCommentUsername(username) ? username : null
}

function flattenCommentTree(root: CommentNode): CommentEntry[] {
  const entries: CommentEntry[] = []

  function visit(comment: CommentNode, depth: number, parentId: string | null, parent: CommentNode | null) {
    entries.push({
      comment,
      depth,
      parentId,
      parentMentionUsername: parent ? mentionUsernameFor(parent) : null,
      verifiedParentUsername: parent ? verifiedUsernameFor(parent) : null,
    })

    comment.replies.forEach((reply) => {
      visit(reply, depth + 1, comment.id, comment)
    })
  }

  visit(root, 0, null, null)
  return entries
}

function ancestorsForTargets(entries: CommentEntry[], targetIds: Array<string | null>): Set<string> {
  const targets = new Set(targetIds.filter((id): id is string => id !== null))
  const parentById = new Map(entries.map(({ comment, parentId }) => [comment.id, parentId]))
  const ancestors = new Set<string>()
  for (const target of targets) {
    let parentId = parentById.get(target) ?? null
    while (parentId) {
      ancestors.add(parentId)
      parentId = parentById.get(parentId) ?? null
    }
  }
  return ancestors
}

function commentElementId(commentId: string, targetCommentId: string | null, targetElementId: string | null): string {
  return commentId === targetCommentId ? (targetElementId ?? discussionCommentElementId(commentId)) : `comment-${commentId}`
}

export function CommentItem({ comment, paths, locked = false, targetCommentId = null, targetElementId = null, highlightedCommentId = null, replyController, request, onChanged }: CommentItemProps) {
  const entries = useMemo(() => flattenCommentTree(comment), [comment])
  const requiredExpandedIds = useMemo(() => ancestorsForTargets(entries, [targetCommentId, highlightedCommentId]), [entries, highlightedCommentId, targetCommentId])
  const [expandedReplyIds, setExpandedReplyIds] = useState(() => new Set(requiredExpandedIds))

  useLayoutEffect(() => {
    if (requiredExpandedIds.size === 0) return
    // oxlint-disable-next-line react/set-state-in-effect -- A changed deep link must reveal its ancestors without remounting.
    setExpandedReplyIds((current) => {
      const next = new Set(current)
      requiredExpandedIds.forEach((id) => next.add(id))
      return next.size === current.size ? current : next
    })
  }, [requiredExpandedIds])

  function toggleReplies(commentId: string) {
    setExpandedReplyIds((current) => {
      const next = new Set(current)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  function expandReplies(commentId: string) {
    setExpandedReplyIds((current) => {
      if (current.has(commentId)) return current
      return new Set(current).add(commentId)
    })
  }

  const visibleById = new Map<string, boolean>()
  return (
    <div className={styles.commentThread}>
      {entries.map((entry) => {
        const visible = entry.parentId === null || (visibleById.get(entry.parentId) === true && expandedReplyIds.has(entry.parentId))
        visibleById.set(entry.comment.id, visible)

        return (
          <CommentRow
            key={entry.comment.id}
            entry={entry}
            paths={paths}
            locked={locked}
            targetCommentId={targetCommentId}
            targetElementId={targetElementId}
            highlightedCommentId={highlightedCommentId}
            expanded={expandedReplyIds.has(entry.comment.id)}
            visible={visible}
            onToggleReplies={toggleReplies}
            onExpandReplies={expandReplies}
            replyController={replyController}
            request={request}
            onChanged={onChanged}
          />
        )
      })}
    </div>
  )
}

type CommentRowProps = Omit<CommentItemProps, 'comment'> & {
  entry: CommentEntry
  expanded: boolean
  visible: boolean
  onToggleReplies: (commentId: string) => void
  onExpandReplies: (commentId: string) => void
}

function CommentRow({
  entry,
  paths,
  locked = false,
  targetCommentId = null,
  targetElementId = null,
  highlightedCommentId = null,
  replyController,
  request,
  onChanged,
  expanded,
  visible,
  onToggleReplies,
  onExpandReplies,
}: CommentRowProps) {
  const { comment, depth, parentMentionUsername, verifiedParentUsername } = entry
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) => communityText(t, language, key, vi, en, values)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const replyIdempotencyKeyRef = useRef<{
    content: string
    key: string
  } | null>(null)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const replyButtonRef = useRef<HTMLButtonElement>(null)
  const replying = replyController.activeCommentId === comment.id
  const replyDraft = replyController.getDraft(comment.id)
  const resolvedAuthorUsername = comment.authorUsername === undefined ? comment.authorName : comment.authorUsername
  const mentionUsername = mentionUsernameFor(comment)
  const profilePath = publicCommentProfilePath(mentionUsername)
  const avatarSource = resolveAvatarUrl(comment.avatarUrl)
  const repliesCount = comment.replies.length
  const repliesCountLabel = repliesCount.toLocaleString(locale)
  const replyIndent = Math.min(depth, MAX_VISUAL_REPLY_DEPTH) * REPLY_INDENT_STEP_PX
  const rowStyle: ReplyRowStyle | undefined = depth > 0 ? { '--reply-indent': `${replyIndent}px` } : undefined
  const avatarLabel = text('viewCommentAuthorProfile', 'Mở hồ sơ của {{name}}', 'Open {{name}}’s profile', { name: resolvedAuthorUsername ?? comment.authorName })

  useLayoutEffect(() => {
    if (!replying || !visible) return
    const input = replyInputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(replyController.focusOffset, replyController.focusOffset)
  }, [replyController.focusOffset, replying, visible])

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
    const idempotencyKey = paths.supportsIdempotencyKey ? (pending?.content === content ? pending.key : crypto.randomUUID()) : null
    if (idempotencyKey) replyIdempotencyKeyRef.current = { content, key: idempotencyKey }
    try {
      await request(paths.create, {
        method: 'POST',
        ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
        body: JSON.stringify({ content, parentId: comment.id }),
      })
      replyIdempotencyKeyRef.current = null
      replyController.completeReply(comment.id)
      onExpandReplies(comment.id)
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

  const repliesToggle =
    repliesCount > 0 ? (
      <button
        className={`${styles.linkButton} ${styles.replyToggle}`}
        type="button"
        aria-expanded={expanded}
        aria-controls={comment.replies.map((reply) => commentElementId(reply.id, targetCommentId, targetElementId)).join(' ')}
        onClick={() => onToggleReplies(comment.id)}
      >
        {expanded
          ? text('hideReplies', 'Ẩn {{count}} câu trả lời', repliesCount === 1 ? 'Hide {{count}} reply' : 'Hide {{count}} replies', { count: repliesCountLabel })
          : text('showReplies', 'Xem {{count}} câu trả lời', repliesCount === 1 ? 'Show {{count}} reply' : 'Show {{count}} replies', { count: repliesCountLabel })}
      </button>
    ) : null

  return (
    <div
      hidden={!visible}
      id={commentElementId(comment.id, targetCommentId, targetElementId)}
      className={[styles.comment, depth === 0 ? styles.commentRoot : styles.reply, comment.id === highlightedCommentId ? styles.commentTargetHighlight : ''].filter(Boolean).join(' ')}
      style={rowStyle}
      tabIndex={comment.id === targetCommentId ? -1 : undefined}
    >
      {comment.isDeleted ? (
        <>
          <p className={styles.deletedComment}>{text('commentDeleted', 'Bình luận đã bị xóa', 'Comment deleted')}</p>
          {repliesToggle}
        </>
      ) : (
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
                  <Link className={styles.commentProfileLink} to={profilePath}>
                    {comment.authorName}
                  </Link>
                ) : (
                  comment.authorName
                )}
              </strong>
              <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt, locale)}</time>
              {comment.updatedAt !== comment.createdAt ? <span>{text('edited', 'Đã chỉnh sửa', 'Edited')}</span> : null}
            </div>
            {depth > MAX_VISUAL_REPLY_DEPTH && verifiedParentUsername ? (
              <p className={styles.replyTargetLabel}>{text('replyingTo', 'Trả lời @{{name}}', 'Replying to @{{name}}', { name: verifiedParentUsername })}</p>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {editing ? (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault()
                  void mutate(
                    {
                      method: 'PATCH',
                      body: JSON.stringify({ content: draft.trim() }),
                    },
                    () => setEditing(false),
                  )
                }}
              >
                <textarea className={styles.textarea} aria-label={text('editComment', 'Sửa bình luận', 'Edit comment')} value={draft} maxLength={5000} rows={3} onChange={(event) => setDraft(event.target.value)} />
                <div className={styles.actions}>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>
                    {text('save', 'Lưu', 'Save')}
                  </button>
                  <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setEditing(false)}>
                    {text('cancel', 'Hủy', 'Cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <CommentText content={comment.content} replyToUsername={parentMentionUsername} />
            )}
            {!editing ? (
              <div className={styles.commentTools}>
                <ReactionBar summary={comment.reactions} path={paths.reaction(comment.id)} small />
                {!locked ? (
                  <button ref={replyButtonRef} className={styles.linkButton} type="button" onClick={startReply}>
                    {text('reply', 'Trả lời', 'Reply')}
                  </button>
                ) : null}
                {comment.canEdit ? (
                  <button className={styles.linkButton} type="button" onClick={() => setEditing(true)}>
                    {text('edit', 'Chỉnh sửa', 'Edit')}
                  </button>
                ) : null}
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
            {repliesToggle}
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
                  <button className={styles.primaryButton} type="submit" disabled={busy}>
                    {busy ? text('sending', 'Đang gửi…', 'Sending…') : text('sendReply', 'Gửi phản hồi', 'Post reply')}
                  </button>
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
          </div>
        </div>
      )}
    </div>
  )
}
