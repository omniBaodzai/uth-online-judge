import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import { request } from '../../auth/api'
import { buildQuery, type NewsListItem, type PageResult } from '../api'
import { formatDate, totalPages } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import styles from '../community.module.css'

const PAGE_SIZE = 10

function NewsListPage() {
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
    () => request<PageResult<NewsListItem>>(`/news${buildQuery({ page, pageSize: PAGE_SIZE, q })}`),
    [page, q],
  )

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Tin tức</h1>
            <p>Thông báo và bài viết chính thức từ ban quản trị UTH Online Judge.</p>
          </div>
        </header>

        <div className={styles.toolbar} role="search">
          <input
            className={styles.search}
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tìm theo tiêu đề hoặc tóm tắt"
            aria-label="Tìm tin tức"
          />
        </div>

        <section className={styles.card} aria-label="Danh sách tin tức" aria-busy={result.status === 'loading'}>
          {result.status === 'error' ? (
            <div className={`${styles.state} ${styles.stateError}`} role="alert">
              <strong>Không thể tải tin tức</strong>
              <span>{errorMessage(result.error)}</span>
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>Thử lại</button>
            </div>
          ) : result.status === 'loading' ? (
            <div className={styles.state}>Đang tải tin tức…</div>
          ) : result.data.items.length === 0 ? (
            <div className={styles.state}>
              <strong>{q ? 'Không tìm thấy tin tức phù hợp' : 'Chưa có tin tức nào'}</strong>
              <span>{q ? 'Hãy thử từ khóa khác.' : 'Tin tức mới sẽ xuất hiện tại đây.'}</span>
            </div>
          ) : (
            result.data.items.map((item) => (
              <Link className={styles.entry} to={`/news/${encodeURIComponent(item.slug)}`} key={item.id}>
                <h2 className={styles.entryTitle}>{item.title}</h2>
                <p className={styles.entrySummary}>{item.summary}</p>
                <p className={styles.meta}>
                  <span className={styles.category}>{item.category}</span>
                  <span>{item.authorName}</span>
                  <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time>
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
            label="tin tức"
          />
        ) : null}
      </div>
    </main>
  )
}

export default NewsListPage
