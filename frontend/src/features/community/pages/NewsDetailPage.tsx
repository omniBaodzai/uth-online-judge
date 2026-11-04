import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Markdown from '../../../components/ui/Markdown'
import { ApiError, request } from '../../auth/api'
import type { NewsArticle } from '../api'
import { formatDate } from '../format'
import { errorMessage, useAsync } from '../useAsync'
import { communityText } from '../translate'
import styles from '../community.module.css'

function NewsDetailPage() {
  const { t, i18n } = useTranslation('pages')
  const text = (key: string, vi: string, en: string) => communityText(t, i18n.resolvedLanguage ?? i18n.language, key, vi, en)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { slug = '' } = useParams()
  const result = useAsync(() => request<NewsArticle>(`/news/${encodeURIComponent(slug)}`), [slug])
  const notFound = result.status === 'error' && result.error instanceof ApiError && result.error.status === 404

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        {result.status === 'loading' ? (
          <div className={`${styles.card} ${styles.state}`}>{text('articleLoading', 'Đang tải bài viết…', 'Loading article…')}</div>
        ) : result.status === 'error' ? (
          <div className={`${styles.card} ${styles.state} ${notFound ? '' : styles.stateError}`} role="alert">
            <strong>{notFound ? text('articleNotFound', 'Không tìm thấy bài viết', 'Article not found') : text('articleLoadError', 'Không thể tải bài viết', 'Could not load article')}</strong>
            <span>{notFound ? text('articleUnavailable', 'Bài viết không tồn tại hoặc chưa được xuất bản.', 'This article does not exist or has not been published.') : errorMessage(result.error, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'))}</span>
            {notFound ? (
              <Link className={styles.secondaryButton} to="/news">{text('backToNews', 'Quay lại danh sách tin tức', 'Back to news')}</Link>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={result.reload}>{text('retry', 'Thử lại', 'Retry')}</button>
            )}
          </div>
        ) : (
          <article className={`${styles.card} ${styles.article}`}>
            <h1 className={styles.articleTitle}>{result.data.title}</h1>
            <p className={styles.articleMeta}>
              <span className={styles.category}>{result.data.category}</span>
              <span>{result.data.authorName}</span>
              <time dateTime={result.data.publishedAt ?? undefined}>{formatDate(result.data.publishedAt, locale)}</time>
            </p>
            <Markdown source={result.data.content} />
          </article>
        )}
      </div>
    </main>
  )
}

export default NewsDetailPage
