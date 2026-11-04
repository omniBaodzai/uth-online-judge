import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Pagination from '../../../components/ui/Pagination'
import { request } from '../../auth/api'
import { buildQuery, type NewsListItem, type PageResult } from '../api'
import { formatDate, totalPages } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import { communityText } from '../translate'
import styles from '../community.module.css'

const PAGE_SIZE = 10

function NewsListPage() {
  const { t, i18n } = useTranslation('pages')
  const text = (key: string, vi: string, en: string) => communityText(t, i18n.resolvedLanguage ?? i18n.language, key, vi, en)
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
    () => request<PageResult<NewsListItem>>(`/news${buildQuery({ page, pageSize: PAGE_SIZE, q })}`),
    [page, q],
  )

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>{text('newsTitle', 'Tin tức', 'News')}</h1>
            <p></p>
          </div>
        </header>

        <div className={styles.toolbar} role="search">
          <input
            className={styles.search}
            type="search"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
            placeholder={text('newsSearchPlaceholder', 'Tìm theo tiêu đề hoặc tóm tắt', 'Search by title or summary')}
            aria-label={text('newsSearchLabel', 'Tìm tin tức', 'Search news')}
          />
        </div>

        <section className={styles.card} aria-label={text('newsListLabel', 'Danh sách tin tức', 'News list')} aria-busy={result.status === 'loading'}>
          {result.status === 'error' ? (
            <div className={`${styles.state} ${styles.stateError}`} role="alert">
              <strong>{text('newsLoadError', 'Không thể tải tin tức', 'Could not load news')}</strong>
              <span>{errorMessage(result.error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'))}</span>
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>{text('retry', 'Thử lại', 'Retry')}</button>
            </div>
          ) : result.status === 'loading' ? (
            <div className={styles.state}>{text('newsLoading', 'Đang tải tin tức…', 'Loading news…')}</div>
          ) : result.data.items.length === 0 ? (
            <div className={styles.state}>
              <strong>{q ? text('noMatchingNews', 'Không tìm thấy tin tức phù hợp', 'No matching news found') : text('noNews', 'Chưa có tin tức nào', 'No news yet')}</strong>
              <span>{q ? text('changeSearch', 'Hãy thử từ khóa khác.', 'Try a different search term.') : text('newsWillAppear', 'Tin tức mới sẽ xuất hiện tại đây.', 'New updates will appear here.')}</span>
            </div>
          ) : (
            result.data.items.map((item) => (
              <Link className={styles.entry} to={`/news/${encodeURIComponent(item.slug)}`} key={item.id}>
                <h2 className={styles.entryTitle}>{item.title}</h2>
                <p className={styles.entrySummary}>{item.summary}</p>
                <p className={styles.meta}>
                  <span className={styles.category}>{item.category}</span>
                  <span>{item.authorName}</span>
                  <time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt, locale)}</time>
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
            label={text('newsLabel', 'tin tức', 'news')}
          />
        ) : null}
      </div>
    </main>
  )
}

export default NewsListPage
