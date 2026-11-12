import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { useToast } from '../../../components/ui/toast-context'
import { buildLoginPath } from '../../auth/return-path'
import { buildQuery, useCommunityRequest, type PageResult } from '../../community/api'
import { CommentItem, type CommentNode, type CommentPaths } from '../../community/CommentItem'
import { useCommentReply } from '../../community/useCommentReply'
import { totalPages } from '../../community/format'
import { communityText } from '../../community/translate'
import { errorMessage, useAsync } from '../../community/useAsync'
import styles from '../../community/community.module.css'
import {
  locateProblemCommentPage,
  problemCommentElementId,
  PROBLEM_COMMENTS_PAGE_SIZE,
} from '../../community/problem-comment-navigation'

const PAGE_SIZE = PROBLEM_COMMENTS_PAGE_SIZE

function problemCommentPaths(code: string): CommentPaths {
  return {
    create: `/problems/${encodeURIComponent(code)}/comments`,
    item: (commentId) => `/problem-comments/${encodeURIComponent(commentId)}`,
    reaction: (commentId) => `/problem-comments/${encodeURIComponent(commentId)}/reaction`,
    supportsIdempotencyKey: true,
  }
}

export default function ProblemComments({ code }: { code: string }) {
  const { t, i18n } = useTranslation('pages')
  const [searchParams] = useSearchParams()
  const targetCommentId = searchParams.get('commentId')
  const targetRootCommentId = searchParams.get('rootCommentId')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, language, key, vi, en, values)
  const { request, isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const replyController = useCommentReply()
  const [commentTargetSearch, setCommentTargetSearch] = useState<{
    key: string
    status: 'searching' | 'located' | 'missing' | 'error'
    page?: number
    targetFound?: boolean
    anchorCommentId?: string
  } | null>(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null)
  const idempotencyKeyRef = useRef<{ content: string; key: string } | null>(null)
  const paths = problemCommentPaths(code)

  const comments = useAsync(
    isReady
      ? () => request<PageResult<CommentNode>>(`${paths.create}${buildQuery({ page, pageSize: PAGE_SIZE })}`)
      : null,
    [code, page, isReady, isAuthenticated],
  )
  const targetSearchKey = targetCommentId ? `${code}:${targetCommentId}:${targetRootCommentId ?? ''}` : null
  const activeCommentTargetSearch = commentTargetSearch?.key === targetSearchKey
    ? commentTargetSearch
    : null
  const commentTargetStatus = targetSearchKey
    ? activeCommentTargetSearch?.status ?? 'searching'
    : null

  useEffect(() => {
    if (!targetSearchKey || !targetCommentId || !isReady) return

    const controller = new AbortController()
    let active = true
    void locateProblemCommentPage(
      (lookupPage, pageSize) =>
        request<PageResult<CommentNode>>(
          `${paths.create}${buildQuery({ page: lookupPage, pageSize })}`,
          { signal: controller.signal },
        ),
      targetCommentId,
      targetRootCommentId,
    ).then((located) => {
      if (!active) return
      if (!located) {
        setCommentTargetSearch({ key: targetSearchKey, status: 'missing' })
        return
      }
      setHighlightedCommentId(null)
      setPage(located.page)
      setCommentTargetSearch({
        key: targetSearchKey,
        status: 'located',
        page: located.page,
        targetFound: located.targetFound,
        anchorCommentId: located.anchorCommentId,
      })
    }).catch(() => {
      if (active && !controller.signal.aborted) {
        setCommentTargetSearch({ key: targetSearchKey, status: 'error' })
      }
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [code, isReady, paths.create, request, targetCommentId, targetRootCommentId, targetSearchKey])

  const displayedCommentPage = comments.status === 'ready' ? comments.data.page : null
  useEffect(() => {
    const search = activeCommentTargetSearch
    if (
      !search
      || search.status !== 'located'
      || !search.anchorCommentId
      || comments.status !== 'ready'
      || displayedCommentPage !== search.page
    ) {
      return
    }

    const target = document.getElementById(problemCommentElementId(search.anchorCommentId))
    if (!target) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    target.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    target.focus({ preventScroll: true })

    if (!search.targetFound || !targetCommentId) return
    const highlightStartTimeoutId = window.setTimeout(() => setHighlightedCommentId(targetCommentId), 0)
    const highlightEndTimeoutId = window.setTimeout(() => setHighlightedCommentId(null), 2600)
    return () => {
      window.clearTimeout(highlightStartTimeoutId)
      window.clearTimeout(highlightEndTimeoutId)
    }
  }, [activeCommentTargetSearch, comments.status, displayedCommentPage, targetCommentId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content) {
      setError(text('commentRequired', 'Vui lòng nhập nội dung bình luận.', 'Please enter a comment.'))
      return
    }
    setBusy(true)
    setError('')
    const pending = idempotencyKeyRef.current
    const idempotencyKey = pending?.content === content ? pending.key : crypto.randomUUID()
    idempotencyKeyRef.current = { content, key: idempotencyKey }
    try {
      await request(paths.create, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ content }),
      })
      setDraft('')
      idempotencyKeyRef.current = null
      comments.reload()
    } catch (caught) {
      setError(errorMessage(caught, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={styles.card}>
        {commentTargetStatus === 'searching' ? (
          <p className={styles.commentTargetNotice} role="status">{text('findingNotifiedComment', 'Đang tìm vị trí bình luận…', 'Finding the notified comment…')}</p>
        ) : null}
        {commentTargetStatus === 'missing' ? (
          <p className={styles.commentTargetNotice} role="status">{text('notifiedCommentUnavailable', 'Bình luận hoặc bài tập không còn khả dụng.', 'The comment or problem is no longer available.')}</p>
        ) : null}
        {commentTargetStatus === 'error' ? (
          <p className={`${styles.commentTargetNotice} ${styles.stateError}`} role="alert">{text('notifiedCommentLookupError', 'Không thể tìm vị trí bình luận. Bạn vẫn có thể duyệt các trang bên dưới.', 'Could not locate the comment. You can still browse the pages below.')}</p>
        ) : null}
        {activeCommentTargetSearch?.status === 'located' && !activeCommentTargetSearch.targetFound ? (
          <p className={styles.commentTargetNotice} role="status">{text('notifiedCommentDeleted', 'Bình luận đã bị xóa; đang hiển thị phần thảo luận gần nhất còn khả dụng.', 'The comment was deleted; showing the nearest available comment.')}</p>
        ) : null}
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
              paths={paths}
              targetCommentId={activeCommentTargetSearch?.anchorCommentId}
              targetElementId={
                activeCommentTargetSearch?.anchorCommentId
                  ? problemCommentElementId(activeCommentTargetSearch.anchorCommentId)
                  : null
              }
              highlightedCommentId={
                activeCommentTargetSearch?.targetFound ? highlightedCommentId : null
              }
              replyController={replyController}
              request={request}
              onChanged={comments.reload}
            />
          ))
        )}
      </div>
      {comments.status === 'ready' ? (
        <Pagination
          className={styles.pager}
          currentPage={page}
          totalPages={totalPages(comments.data.total, PAGE_SIZE)}
          onPageChange={setPage}
          label={text('commentsLabel', 'bình luận', 'comments')}
        />
      ) : null}

      <div className={`${styles.card} ${styles.section}`}>
        {isAuthenticated ? (
          <form className={`${styles.form} ${styles.article}`} onSubmit={submit} noValidate>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.field}>
              <label htmlFor="problem-new-comment">{text('writeComment', 'Viết bình luận', 'Write a comment')}</label>
              <textarea id="problem-new-comment" className={styles.textarea} value={draft} maxLength={5000} rows={4} onChange={(event) => setDraft(event.target.value)} />
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
              <Link className={styles.primaryButton} to={buildLoginPath(`/problems/${encodeURIComponent(code)}`)}>
                {text('signInToJoin', 'Đăng nhập để tham gia', 'Sign in to join')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
