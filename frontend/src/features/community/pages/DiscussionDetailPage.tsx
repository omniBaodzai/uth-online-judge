import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { ConfirmDialog } from '../../admin/components/ConfirmDialog'
import { ApiError } from '../../auth/api'
import { buildLoginPath } from '../../auth/return-path'
import {
  buildQuery,
  useCommunityRequest,
  type DiscussionComment,
  type DiscussionDetail,
  type PageResult,
} from '../api'
import { formatDateTime, totalPages } from '../format'
import { useToast } from '../../../components/ui/toast-context'
import { decideGuestAction } from '../guest-actions'
import { ReactionBar } from '../ReactionBar'
import { errorMessage, useAsync } from '../useAsync'
import { communityText } from '../translate'
import styles from '../community.module.css'

const COMMENT_PAGE_SIZE = 20

function DiscussionDetailPage() {
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, language, key, vi, en, values)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { request, isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [commentPage, setCommentPage] = useState(1)
  const [newComment, setNewComment] = useState('')
  const [commentError, setCommentError] = useState('')

  const discussion = useAsync(
    isReady ? () => request<DiscussionDetail>(`/discussions/${encodeURIComponent(id)}`) : null,
    [id, isReady, isAuthenticated],
  )
  const comments = useAsync(
    isReady
      ? () =>
          request<PageResult<DiscussionComment>>(
            `/discussions/${encodeURIComponent(id)}/comments${buildQuery({ page: commentPage, pageSize: COMMENT_PAGE_SIZE })}`,
          )
      : null,
    [id, commentPage, isReady, isAuthenticated],
  )

  async function run(action: () => Promise<void>, onError: (message: string) => void) {
    setBusy(true)
    onError('')
    try {
      await action()
    } catch (error) {
      onError(errorMessage(error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.')))
    } finally {
      setBusy(false)
    }
  }

  function startEdit(current: DiscussionDetail) {
    setDraftTitle(current.title)
    setDraftContent(current.content)
    setActionError('')
    setEditing(true)
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      await request(`/discussions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: draftTitle.trim(), content: draftContent.trim() }),
      })
      setEditing(false)
      discussion.reload()
    }, setActionError)
  }

  async function deleteDiscussion() {
    await run(async () => {
      await request(`/discussions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      navigate('/discussions', { replace: true })
    }, setActionError)
  }

  async function toggleLock(current: DiscussionDetail) {
    await run(async () => {
      await request(`/discussions/${encodeURIComponent(id)}/lock`, {
        method: 'PATCH',
        body: JSON.stringify({ isLocked: !current.isLocked }),
      })
      discussion.reload()
    }, setActionError)
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    const content = newComment.trim()
    if (!content) {
      setCommentError(text('commentRequired', 'Vui lòng nhập nội dung bình luận.', 'Please enter a comment.'))
      return
    }
    await run(async () => {
      await request(`/discussions/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      setNewComment('')
      discussion.reload()
      comments.reload()
    }, setCommentError)
  }

  if (discussion.status === 'error') {
    const notFound = discussion.error instanceof ApiError && (discussion.error.status === 404 || discussion.error.status === 400)
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <div className={`${styles.card} ${styles.state} ${notFound ? '' : styles.stateError}`} role="alert">
            <strong>{notFound ? text('discussionNotFound', 'Không tìm thấy chủ đề', 'Discussion not found') : text('discussionLoadError', 'Không thể tải chủ đề', 'Could not load discussion')}</strong>
            <span>{notFound ? text('discussionUnavailable', 'Chủ đề không tồn tại hoặc đã bị xóa.', 'This discussion does not exist or has been deleted.') : errorMessage(discussion.error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'))}</span>
            {notFound ? (
              <Link className={styles.secondaryButton} to="/discussions">{text('backToDiscussions', 'Quay lại danh sách', 'Back to discussions')}</Link>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={discussion.reload}>{text('retry', 'Thử lại', 'Retry')}</button>
            )}
          </div>
        </div>
      </main>
    )
  }

  if (discussion.status === 'loading') {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <div className={`${styles.card} ${styles.state}`}>{text('discussionLoading', 'Đang tải chủ đề…', 'Loading discussion…')}</div>
        </div>
      </main>
    )
  }

  const current = discussion.data

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <article className={`${styles.card} ${styles.article}`}>
          {editing ? (
            <form className={styles.form} onSubmit={saveEdit} noValidate>
              {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}
              <div className={styles.field}>
                <label htmlFor="edit-title">{text('title', 'Tiêu đề', 'Title')}</label>
                <input id="edit-title" className={styles.input} value={draftTitle} maxLength={200} onChange={(event) => setDraftTitle(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="edit-content">{text('content', 'Nội dung', 'Content')}</label>
                <textarea id="edit-content" className={styles.textarea} value={draftContent} maxLength={10000} rows={8} onChange={(event) => setDraftContent(event.target.value)} />
              </div>
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? text('saving', 'Đang lưu…', 'Saving…') : text('saveChanges', 'Lưu thay đổi', 'Save changes')}</button>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setEditing(false)}>{text('cancel', 'Hủy', 'Cancel')}</button>
              </div>
            </form>
          ) : (
            <>
              <h1 className={styles.articleTitle}>{current.title}</h1>
              <p className={styles.articleMeta}>
                <span>{current.authorName}</span>
                <time dateTime={current.createdAt}>{formatDateTime(current.createdAt, locale)}</time>
                {current.updatedAt !== current.createdAt ? (
                  <span>{text('editedAt', 'Đã chỉnh sửa lúc', 'Edited')} <time dateTime={current.updatedAt}>{formatDateTime(current.updatedAt, locale)}</time></span>
                ) : null}
                {current.isLocked ? <span className={styles.lockBadge}>{text('locked', 'Đã khóa', 'Locked')}</span> : null}
              </p>
              <p className={styles.plainText}>{current.content}</p>
              <ReactionBar summary={current.reactions} path={`/discussions/${encodeURIComponent(id)}/reaction`} />
              {actionError ? <p className={styles.error} role="alert" style={{ marginTop: 16 }}>{actionError}</p> : null}
              {current.canEdit || current.canDelete || current.canModerate ? (
                <div className={styles.actions}>
                  {current.canEdit ? <button className={styles.secondaryButton} type="button" onClick={() => startEdit(current)}>{text('edit', 'Chỉnh sửa', 'Edit')}</button> : null}
                  {current.canModerate ? (
                    <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void toggleLock(current)}>
                      {current.isLocked ? text('unlockDiscussion', 'Mở khóa', 'Unlock discussion') : text('lockDiscussion', 'Khóa thảo luận', 'Lock discussion')}
                    </button>
                  ) : null}
                  {current.canDelete ? <button className={styles.dangerButton} type="button" onClick={() => setConfirmDelete(true)}>{text('delete', 'Xóa', 'Delete')}</button> : null}
                </div>
              ) : null}
            </>
          )}
        </article>

        <section className={styles.section} aria-label={text('comments', 'Bình luận', 'Comments')}>
          <h2>{text('commentsCount', 'Bình luận ({{count}})', 'Comments ({{count}})', { count: current.replies.toLocaleString(locale) })}</h2>
          <div className={styles.card}>
            {comments.status === 'error' ? (
              <div className={`${styles.state} ${styles.stateError}`} role="alert">
                <span>{errorMessage(comments.error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'))}</span>
                <button className={styles.secondaryButton} type="button" onClick={comments.reload}>{text('retry', 'Thử lại', 'Retry')}</button>
              </div>
            ) : comments.status === 'loading' ? (
              <div className={styles.state}>{text('commentsLoading', 'Đang tải bình luận…', 'Loading comments…')}</div>
            ) : comments.data.items.length === 0 ? (
              <div className={styles.state}>{text('noComments', 'Chưa có bình luận nào.', 'No comments yet.')}</div>
            ) : (
              comments.data.items.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  discussionId={id}
                  locked={current.isLocked}
                  request={request}
                  onChanged={() => {
                    discussion.reload()
                    comments.reload()
                  }}
                />
              ))
            )}
          </div>
          {comments.status === 'ready' ? (
            <Pagination
              className={styles.pager}
              currentPage={commentPage}
              totalPages={totalPages(comments.data.total, COMMENT_PAGE_SIZE)}
              onPageChange={setCommentPage}
              label={text('commentsLabel', 'bình luận', 'comments')}
            />
          ) : null}

          <div className={`${styles.card} ${styles.section}`}>
            {current.isLocked ? (
              <p className={styles.loginPrompt}>{text('discussionLockedPrompt', 'Chủ đề đã bị khóa, không thể thêm bình luận mới.', 'This discussion is locked; new comments are disabled.')}</p>
            ) : isAuthenticated ? (
              <form className={`${styles.form} ${styles.article}`} onSubmit={submitComment} noValidate>
                {commentError ? <p className={styles.error} role="alert">{commentError}</p> : null}
                <div className={styles.field}>
                  <label htmlFor="new-comment">{text('writeComment', 'Viết bình luận', 'Write a comment')}</label>
                  <textarea id="new-comment" className={styles.textarea} value={newComment} maxLength={5000} rows={4} onChange={(event) => setNewComment(event.target.value)} />
                </div>
                <div>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? text('sending', 'Đang gửi…', 'Sending…') : text('sendComment', 'Gửi bình luận', 'Post comment')}</button>
                </div>
              </form>
            ) : (
              <div className={styles.joinPrompt}>
                <div>
                  <h3>{text('joinDiscussion', 'Tham gia cuộc thảo luận', 'Join the discussion')}</h3>
                  <p>{text('signInToComment', 'Đăng nhập để bình luận và trao đổi với cộng đồng.', 'Sign in to comment and engage with the community.')}</p>
                </div>
                <div className={styles.actions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => showToast(text('guestComment', 'Bạn cần đăng nhập để bình luận.', 'Sign in to comment.'))}>
                    {text('writeComment', 'Viết bình luận', 'Write a comment')}
                  </button>
                  <Link className={styles.primaryButton} to={buildLoginPath(`/discussions/${encodeURIComponent(id)}`)}>
                    {text('signInToJoin', 'Đăng nhập để tham gia', 'Sign in to join')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title={text('deleteDiscussionTitle', 'Xóa chủ đề?', 'Delete discussion?')}
          description={text('deleteDiscussionDescription', 'Chủ đề và toàn bộ bình luận sẽ bị xóa vĩnh viễn.', 'The discussion and all its comments will be permanently deleted.')}
          confirmLabel={text('deleteDiscussion', 'Xóa chủ đề', 'Delete discussion')}
          danger
          busy={busy}
          error={actionError}
          onConfirm={() => void deleteDiscussion()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </main>
  )
}

type CommentItemProps = {
  comment: DiscussionComment
  discussionId: string
  locked: boolean
  isReply?: boolean
  request: ReturnType<typeof useCommunityRequest>['request']
  onChanged: () => void
}

function CommentItem({ comment, discussionId, locked, isReply = false, request, onChanged }: CommentItemProps) {
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
      await request(`/discussions/${encodeURIComponent(discussionId)}/comments`, {
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
      await request(`/discussion-comments/${encodeURIComponent(comment.id)}`, init)
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
          discussionId={discussionId}
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
          <ReactionBar summary={comment.reactions} path={`/discussion-comments/${encodeURIComponent(comment.id)}/reaction`} small />
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

export default DiscussionDetailPage
