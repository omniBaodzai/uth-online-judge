import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import { request } from '../../auth/api'
import { buildQuery, type DiscussionListItem, type PageResult } from '../api'
import { formatDateTime, totalPages } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import { CreateDiscussionButton } from '../CreateDiscussionButton'
import styles from '../community.module.css'

const PAGE_SIZE = 10

function DiscussionListPage() {
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
            <h1>Thảo luận</h1>
            <p>Đặt câu hỏi và trao đổi cùng cộng đồng UTH Online Judge.</p>
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
            placeholder="Tìm theo tiêu đề hoặc nội dung"
            aria-label="Tìm thảo luận"
          />
        </div>

        <section className={styles.card} aria-label="Danh sách thảo luận" aria-busy={result.status === 'loading'}>
          {result.status === 'error' ? (
            <div className={`${styles.state} ${styles.stateError}`} role="alert">
              <strong>Không thể tải thảo luận</strong>
              <span>{errorMessage(result.error)}</span>
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>Thử lại</button>
            </div>
          ) : result.status === 'loading' ? (
            <div className={styles.state}>Đang tải thảo luận…</div>
          ) : result.data.items.length === 0 ? (
            <div className={styles.state}>
              <strong>{q ? 'Không tìm thấy thảo luận phù hợp' : 'Chưa có cuộc thảo luận nào'}</strong>
              <span>{q ? 'Hãy thử từ khóa khác.' : 'Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ kinh nghiệm với cộng đồng.'}</span>
              {q ? null : <CreateDiscussionButton className={styles.primaryButton} />}
            </div>
          ) : (
            result.data.items.map((item) => (
              <Link className={styles.entry} to={`/discussions/${encodeURIComponent(item.id)}`} key={item.id}>
                <h2 className={styles.entryTitle}>{item.title}</h2>
                <p className={styles.entrySummary}>{item.summary}</p>
                <p className={styles.meta}>
                  <span>{item.authorName}</span>
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                  <span>{item.replies} phản hồi</span>
                  {item.reactionCount > 0 ? <span>{item.reactionCount} cảm xúc</span> : null}
                  {item.isLocked ? <span className={styles.lockBadge}>Đã khóa</span> : null}
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
            label="thảo luận"
          />
        ) : null}
      </div>
    </main>
  )
}

export default DiscussionListPage
