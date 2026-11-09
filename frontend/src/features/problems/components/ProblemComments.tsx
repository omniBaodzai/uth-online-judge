import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { useToast } from '../../../components/ui/toast-context'
import { buildLoginPath } from '../../auth/return-path'
import { buildQuery, useCommunityRequest, type PageResult } from '../../community/api'
import { CommentItem, type CommentNode, type CommentPaths } from '../../community/CommentItem'
import { totalPages } from '../../community/format'
import { communityText } from '../../community/translate'
import { errorMessage, useAsync } from '../../community/useAsync'
import styles from '../../community/community.module.css'

const PAGE_SIZE = 10

function problemCommentPaths(code: string): CommentPaths {
  return {
    create: `/problems/${encodeURIComponent(code)}/comments`,
    item: (commentId) => `/problem-comments/${encodeURIComponent(commentId)}`,
    reaction: (commentId) => `/problem-comments/${encodeURIComponent(commentId)}/reaction`,
  }
}

export default function ProblemComments({ code }: { code: string }) {
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, language, key, vi, en, values)
  const { request, isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const paths = problemCommentPaths(code)

  const comments = useAsync(
    isReady
      ? () => request<PageResult<CommentNode>>(`${paths.create}${buildQuery({ page, pageSize: PAGE_SIZE })}`)
      : null,
    [code, page, isReady, isAuthenticated],
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content) {
      setError(text('commentRequired', 'Vui lòng nhập nội dung bình luận.', 'Please enter a comment.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await request(paths.create, { method: 'POST', body: JSON.stringify({ content }) })
      setDraft('')
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
            <CommentItem key={comment.id} comment={comment} paths={paths} request={request} onChanged={comments.reload} />
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
