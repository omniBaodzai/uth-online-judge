import { Link, useParams } from 'react-router-dom'
import Markdown from '../../../components/ui/Markdown'
import { ApiError, request } from '../../auth/api'
import type { NewsArticle } from '../api'
import { formatDate } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import styles from '../community.module.css'

function NewsDetailPage() {
  const { slug = '' } = useParams()
  const result = useAsync(() => request<NewsArticle>(`/news/${encodeURIComponent(slug)}`), [slug])
  const notFound = result.status === 'error' && result.error instanceof ApiError && result.error.status === 404

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        {result.status === 'loading' ? (
          <div className={`${styles.card} ${styles.state}`}>Đang tải bài viết…</div>
        ) : result.status === 'error' ? (
          <div className={`${styles.card} ${styles.state} ${notFound ? '' : styles.stateError}`} role="alert">
            <strong>{notFound ? 'Không tìm thấy bài viết' : 'Không thể tải bài viết'}</strong>
            <span>{notFound ? 'Bài viết không tồn tại hoặc chưa được xuất bản.' : errorMessage(result.error)}</span>
            {notFound ? (
              <Link className={styles.secondaryButton} to="/news">Quay lại danh sách tin tức</Link>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>Thử lại</button>
            )}
          </div>
        ) : (
          <article className={`${styles.card} ${styles.article}`}>
            <h1 className={styles.articleTitle}>{result.data.title}</h1>
            <p className={styles.articleMeta}>
              <span className={styles.category}>{result.data.category}</span>
              <span>{result.data.authorName}</span>
              <time dateTime={result.data.publishedAt ?? undefined}>{formatDate(result.data.publishedAt)}</time>
            </p>
            <Markdown source={result.data.content} />
          </article>
        )}
      </div>
    </main>
  )
}

export default NewsDetailPage
