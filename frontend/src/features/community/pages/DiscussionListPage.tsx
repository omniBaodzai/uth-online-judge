import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { request } from '../../auth/api'
import { buildQuery, type DiscussionListItem, type PageResult } from '../api'
import { formatDateTime, totalPages } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import { CreateDiscussionButton } from '../CreateDiscussionButton'
import { communityText } from '../translate'
import styles from '../community.module.css'

const PAGE_SIZE = 10

function DiscussionListPage() {
  const { t, i18n } = useTranslation('pages')
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, i18n.resolvedLanguage ?? i18n.language, key, vi, en, values)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ((current) => {
        const next = input.trim()
        if (next !== current) setPage(1)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [input])

  const result = useAsync(
    () => request<PageResult<DiscussionListItem>>(`/discussions${buildQuery({ page, pageSize: PAGE_SIZE, q })}`),
    [page, q],
  )

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>{text('discussionsTitle', 'Thảo luận', 'Discussions')}</h1>
            <p></p>
          </div>
          <CreateDiscussionButton className={styles.primaryButton} />
        </header>

        <div className={styles.toolbar} role="search">
          <input
            className={styles.search}
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
            placeholder={text('discussionSearchPlaceholder', 'Tìm theo tiêu đề hoặc nội dung', 'Search by title or content')}
            aria-label={text('discussionSearchLabel', 'Tìm thảo luận', 'Search discussions')}
          />
        </div>

        <section className={styles.card} aria-label={text('discussionListLabel', 'Danh sách thảo luận', 'Discussion list')} aria-busy={result.status === 'loading'}>
          {result.status === 'error' ? (
            <div className={`${styles.state} ${styles.stateError}`} role="alert">
              <strong>{text('discussionsLoadError', 'Không thể tải thảo luận', 'Could not load discussions')}</strong>
              <span>{errorMessage(result.error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'))}</span>
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>{text('retry', 'Thử lại', 'Retry')}</button>
            </div>
          ) : result.status === 'loading' ? (
            <div className={styles.state}>{text('discussionsLoading', 'Đang tải thảo luận…', 'Loading discussions…')}</div>
          ) : result.data.items.length === 0 ? (
            <div className={styles.state}>
              <strong>{q ? text('noMatchingDiscussions', 'Không tìm thấy thảo luận phù hợp', 'No matching discussions found') : text('noDiscussions', 'Chưa có cuộc thảo luận nào', 'No discussions yet')}</strong>
              <span>{q ? text('changeSearch', 'Hãy thử từ khóa khác.', 'Try a different search term.') : text('startDiscussion', 'Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ kinh nghiệm với cộng đồng.', 'Be the first to ask a question or share your experience with the community.')}</span>
              {q ? null : <CreateDiscussionButton className={styles.primaryButton} />}
            </div>
          ) : (
            result.data.items.map((item) => (
              <Link className={styles.entry} to={`/discussions/${encodeURIComponent(item.id)}`} key={item.id}>
                <h2 className={styles.entryTitle}>{item.title}</h2>
                <p className={styles.entrySummary}>{item.summary}</p>
                <p className={styles.meta}>
                  <span>{item.authorName}</span>
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt, locale)}</time>
                  <span>{text('replyCount', '{{count}} phản hồi', '{{count}} replies', { count: item.replies.toLocaleString(locale) })}</span>
                  {item.reactionCount > 0 ? <span>{text('reactionCount', '{{count}} cảm xúc', '{{count}} reactions', { count: item.reactionCount.toLocaleString(locale) })}</span> : null}
                  {item.isLocked ? <span className={styles.lockBadge}>{text('locked', 'Đã khóa', 'Locked')}</span> : null}
                </p>
              </Link>
            ))
          )}
        </section>

        {result.status === 'ready' ? (
          <Pagination
            className={styles.pager}
            currentPage={page}
            totalPages={totalPages(result.data.total, PAGE_SIZE)}
            onPageChange={setPage}
            label={text('discussionsLabel', 'thảo luận', 'discussions')}
          />
        ) : null}
      </div>
    </main>
  )
}

export default DiscussionListPage
