import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { GUEST_MESSAGES, decideGuestAction } from '../guest-actions'
import { ReactionBar } from '../ReactionBar'
import { errorMessage, useAsync } from '../useAsync'
import styles from '../community.module.css'

const COMMENT_PAGE_SIZE = 20

function DiscussionDetailPage() {
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
      onError(errorMessage(error))
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
      setCommentError('Vui lòng nhập nội dung bình luận.')
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
            <strong>{notFound ? 'Không tìm thấy chủ đề' : 'Không thể tải chủ đề'}</strong>
            <span>{notFound ? 'Chủ đề không tồn tại hoặc đã bị xóa.' : errorMessage(discussion.error)}</span>
            {notFound ? (
              <Link className={styles.secondaryButton} to="/discussions">Quay lại danh sách</Link>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={discussion.reload}>Thử lại</button>
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
          <div className={`${styles.card} ${styles.state}`}>Đang tải chủ đề…</div>
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
                <label htmlFor="edit-title">Tiêu đề</label>
                <input id="edit-title" className={styles.input} value={draftTitle} maxLength={200} onChange={(event) => setDraftTitle(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="edit-content">Nội dung</label>
                <textarea id="edit-content" className={styles.textarea} value={draftContent} maxLength={10000} rows={8} onChange={(event) => setDraftContent(event.target.value)} />
              </div>
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setEditing(false)}>Hủy</button>
              </div>
            </form>
          ) : (
            <>
              <h1 className={styles.articleTitle}>{current.title}</h1>
              <p className={styles.articleMeta}>
                <span>{current.authorName}</span>
                <time dateTime={current.createdAt}>{formatDateTime(current.createdAt)}</time>
                {current.updatedAt !== current.createdAt ? (
                  <span>Đã chỉnh sửa lúc <time dateTime={current.updatedAt}>{formatDateTime(current.updatedAt)}</time></span>
                ) : null}
                {current.isLocked ? <span className={styles.lockBadge}>Đã khóa</span> : null}
              </p>
              <p className={styles.plainText}>{current.content}</p>
              <ReactionBar summary={current.reactions} path={`/discussions/${encodeURIComponent(id)}/reaction`} />
              {actionError ? <p className={styles.error} role="alert" style={{ marginTop: 16 }}>{actionError}</p> : null}
              {current.canEdit || current.canDelete || current.canModerate ? (
                <div className={styles.actions}>
                  {current.canEdit ? <button className={styles.secondaryButton} type="button" onClick={() => startEdit(current)}>Chỉnh sửa</button> : null}
                  {current.canModerate ? (
                    <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void toggleLock(current)}>
                      {current.isLocked ? 'Mở khóa' : 'Khóa thảo luận'}
                    </button>
                  ) : null}
                  {current.canDelete ? <button className={styles.dangerButton} type="button" onClick={() => setConfirmDelete(true)}>Xóa</button> : null}
                </div>
              ) : null}
            </>
          )}
        </article>

        <section className={styles.section} aria-label="Bình luận">
          <h2>Bình luận ({current.replies})</h2>
          <div className={styles.card}>
            {comments.status === 'error' ? (
              <div className={`${styles.state} ${styles.stateError}`} role="alert">
                <span>{errorMessage(comments.error)}</span>
                <button className={styles.secondaryButton} type="button" onClick={comments.reload}>Thử lại</button>
              </div>
            ) : comments.status === 'loading' ? (
              <div className={styles.state}>Đang tải bình luận…</div>
            ) : comments.data.items.length === 0 ? (
              <div className={styles.state}>Chưa có bình luận nào.</div>
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
              label="bình luận"
            />
          ) : null}

          <div className={`${styles.card} ${styles.section}`}>
            {current.isLocked ? (
              <p className={styles.loginPrompt}>Chủ đề đã bị khóa, không thể thêm bình luận mới.</p>
            ) : isAuthenticated ? (
              <form className={`${styles.form} ${styles.article}`} onSubmit={submitComment} noValidate>
                {commentError ? <p className={styles.error} role="alert">{commentError}</p> : null}
                <div className={styles.field}>
                  <label htmlFor="new-comment">Viết bình luận</label>
                  <textarea id="new-comment" className={styles.textarea} value={newComment} maxLength={5000} rows={4} onChange={(event) => setNewComment(event.target.value)} />
                </div>
                <div>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button>
                </div>
              </form>
            ) : (
              <div className={styles.joinPrompt}>
                <div>
                  <h3>Tham gia cuộc thảo luận</h3>
                  <p>Đăng nhập để bình luận và trao đổi với cộng đồng.</p>
                </div>
                <div className={styles.actions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => showToast(GUEST_MESSAGES.comment)}>
                    Viết bình luận
                  </button>
                  <Link className={styles.primaryButton} to={buildLoginPath(`/discussions/${encodeURIComponent(id)}`)}>
                    Đăng nhập để tham gia
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Xóa chủ đề?"
          description="Chủ đề và toàn bộ bình luận sẽ bị xóa vĩnh viễn."
          confirmLabel="Xóa chủ đề"
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
  const { isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)
  const [replying, setReplying] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function startReply() {
    const decision = decideGuestAction({ isReady, isAuthenticated }, 'reply')
    if (decision.kind === 'toast') showToast(decision.message)
    else if (decision.kind === 'proceed') setReplying(true)
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault()
    const content = replyDraft.trim()
    if (!content) {
      setError('Vui lòng nhập nội dung phản hồi.')
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
      setError(errorMessage(caught))
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
      setError(errorMessage(caught))
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
        <p className={styles.deletedComment}>Bình luận đã bị xóa</p>
        {replyList}
      </div>
    )
  }

  return (
    <div className={`${styles.comment} ${isReply ? styles.reply : ''}`}>
      <div className={styles.commentHead}>
        <strong>{comment.authorName}</strong>
        <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
        {comment.updatedAt !== comment.createdAt ? <span>Đã chỉnh sửa</span> : null}
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
          <textarea className={styles.textarea} aria-label="Sửa bình luận" value={draft} maxLength={5000} rows={3} onChange={(event) => setDraft(event.target.value)} />
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={busy}>Lưu</button>
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setEditing(false)}>Hủy</button>
          </div>
        </form>
      ) : (
        <p className={styles.plainText}>{comment.content}</p>
      )}
      {!editing ? (
        <div className={styles.commentTools}>
          <ReactionBar summary={comment.reactions} path={`/discussion-comments/${encodeURIComponent(comment.id)}/reaction`} small />
          {!locked ? (
            <button className={styles.linkButton} type="button" onClick={startReply}>Trả lời</button>
          ) : null}
          {comment.canEdit ? <button className={styles.linkButton} type="button" onClick={() => setEditing(true)}>Sửa</button> : null}
          {comment.canDelete ? (
            <button
              className={`${styles.linkButton} ${styles.linkDanger}`}
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Xóa bình luận này?')) void mutate({ method: 'DELETE' })
              }}
            >
              Xóa
            </button>
          ) : null}
        </div>
      ) : null}
      {replying ? (
        <form className={`${styles.form} ${styles.replyForm}`} onSubmit={submitReply} noValidate>
          <textarea
            className={styles.textarea}
            aria-label={`Trả lời ${comment.authorName}`}
            value={replyDraft}
            maxLength={5000}
            rows={3}
            autoFocus
            onChange={(event) => setReplyDraft(event.target.value)}
          />
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setReplying(false)}>Hủy</button>
          </div>
        </form>
      ) : null}
      {replyList}
    </div>
  )
}

export default DiscussionDetailPage
