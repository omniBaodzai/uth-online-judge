import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircleCheck,
  EyeOff,
  FilePenLine,
  Newspaper,
  Percent,
  Plus,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { ApiError } from '../../auth/api'
import { buildQuery, type NewsArticle, type NewsStatus, type PageResult } from '../../community/api'
import { formatDateTime, totalPages } from '../../community/format'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import adminStyles from '../admin.module.css'
import styles from './AdminNewsPage.module.css'

type Pending = { article: NewsArticle; action: 'publish' | 'unpublish' | 'delete' }
type ListItem = Omit<NewsArticle, 'content'>
type MetricTone = 'teal' | 'green' | 'amber' | 'slate'
type NewsStats = { total: number; published: number; draft: number; publishedRate: number }

const PAGE_SIZES = submissionPageSizes
const DEFAULT_PAGE_SIZE = 20
const statusLabels: Record<NewsStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản' }

function AdminNewsPage() {
  const { request, setNotice } = useAdmin()
  const [page, setPage] = useState<PageResult<ListItem> | null>(null)
  const [stats, setStats] = useState<NewsStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState<NewsStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pending, setPending] = useState<Pending | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [statsReloadKey, setStatsReloadKey] = useState(0)
  const normalizedSearch = search.trim()

  useEffect(() => {
    if (normalizedSearch === debounced) return
    const timer = window.setTimeout(() => {
      setDebounced(normalizedSearch)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [debounced, normalizedSearch])

  const fetchPage = useCallback(
    () =>
      request<PageResult<ListItem>>(
        `/admin/news${buildQuery({ page: currentPage, pageSize, q: debounced, status: status === 'all' ? undefined : status })}`,
      ),
    [currentPage, debounced, pageSize, request, status],
  )

  useEffect(() => {
    if (normalizedSearch !== debounced) return
    let active = true
    let clamped = false
    fetchPage()
      .then((data) => {
        if (!active) return
        const lastPage = totalPages(data.total, data.pageSize)
        if (currentPage > lastPage) {
          clamped = true
          setCurrentPage(lastPage)
          return
        }
        setPage(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách tin tức.')
      })
      .finally(() => {
        if (active && !clamped) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentPage, debounced, fetchPage, normalizedSearch, reloadKey])

  useEffect(() => {
    let active = true
    const fetchCount = (newsStatus?: NewsStatus) =>
      request<PageResult<ListItem>>(
        `/admin/news${buildQuery({ page: 1, pageSize: 1, status: newsStatus })}`,
      )

    Promise.all([fetchCount(), fetchCount('DRAFT'), fetchCount('PUBLISHED')])
      .then(([allNews, draftNews, publishedNews]) => {
        if (active) {
          setStats({
            total: allNews.total,
            draft: draftNews.total,
            published: publishedNews.total,
            publishedRate: allNews.total === 0 ? 0 : Math.round((publishedNews.total / allNews.total) * 100),
          })
          setStatsError('')
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setStats(null)
          setStatsError(cause instanceof ApiError ? cause.message : 'Không thể tải thống kê tin tức.')
        }
      })
      .finally(() => {
        if (active) setStatsLoading(false)
      })

    return () => {
      active = false
    }
  }, [request, statsReloadKey])

  async function complete() {
    if (!pending) return
    setSaving(true)
    setDialogError('')
    const { article, action } = pending
    try {
      if (action === 'delete') {
        await request<void>(`/admin/news/${article.id}`, { method: 'DELETE' })
        setNotice(`Đã xóa bài viết “${article.title}”.`)
      } else {
        await request(`/admin/news/${article.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: action === 'publish' ? 'PUBLISHED' : 'DRAFT' }),
        })
        setNotice(action === 'publish' ? `Đã xuất bản “${article.title}”.` : `Đã chuyển “${article.title}” về bản nháp.`)
      }
      setPending(null)
      setLoading(true)
      setError('')
      setReloadKey((value) => value + 1)
      setStats(null)
      setStatsError('')
      setStatsLoading(true)
      setStatsReloadKey((value) => value + 1)
    } catch (cause) {
      setDialogError(cause instanceof ApiError ? cause.message : 'Không thể lưu thay đổi.')
    } finally {
      setSaving(false)
    }
  }

  function clearFilters() {
    if (search || debounced || status !== 'all' || currentPage !== 1) setLoading(true)
    setError('')
    setSearch('')
    setDebounced('')
    setStatus('all')
    setCurrentPage(1)
  }

  function retryStats() {
    setStats(null)
    setStatsError('')
    setStatsLoading(true)
    setStatsReloadKey((value) => value + 1)
  }

  function retryList() {
    setLoading(true)
    setError('')
    setReloadKey((value) => value + 1)
  }

  function changePage(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > pageCount) return
    setError('')
    setLoading(true)
    setCurrentPage(nextPage)
  }

  function changePageSize(nextPageSize: number) {
    if (!PAGE_SIZES.includes(nextPageSize) || nextPageSize === pageSize) return
    setError('')
    setLoading(true)
    setCurrentPage(1)
    setPageSize(nextPageSize)
  }

  const items = page?.items ?? []
  const pageCount = totalPages(page?.total ?? 0, pageSize)

  function renderPagination(placement: 'top' | 'bottom') {
    if (!page || page.total === 0) return null
    return (
      <div className={placement === 'top' ? styles.paginationTop : styles.paginationBottom}>
        <SubmissionPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={page.total}
          pageSizes={PAGE_SIZES}
          label="bài viết"
          summaryLabel="bài viết"
          showPageSize={placement === 'bottom'}
          disabled={loading}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.metrics} aria-label="Thống kê tin tức" aria-busy={statsLoading}>
        <MetricCard label="Tổng tin tức" value={stats?.total} loading={statsLoading} tone="teal" icon={Newspaper} />
        <MetricCard label="Đã xuất bản" value={stats?.published} loading={statsLoading} tone="green" icon={CircleCheck} />
        <MetricCard label="Bản nháp" value={stats?.draft} loading={statsLoading} tone="amber" icon={FilePenLine} />
        <MetricCard
          label="Tỷ lệ xuất bản"
          value={stats ? `${stats.publishedRate}%` : undefined}
          loading={statsLoading}
          tone="slate"
          icon={Percent}
        />
      </section>

      {statsError && (
        <div className={styles.statsError} role="alert">
          <span>{statsError}</span>
          <button type="button" onClick={retryStats} disabled={statsLoading}>Thử tải lại</button>
        </div>
      )}

      <div className={styles.createRow}>
        <Link className={styles.createButton} to="/admin/news/new">
          <Plus size={18} aria-hidden="true" />
          Tạo tin tức
        </Link>
      </div>

      <section className={`${adminStyles.panel} ${styles.newsPanel}`} aria-label="Danh sách tin tức" aria-busy={loading}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <AdminIcon name="search" size={18} />
            <span className={styles.srOnly}>Tìm theo tiêu đề hoặc tóm tắt</span>
            <input
              aria-label="Tìm theo tiêu đề hoặc tóm tắt"
              placeholder="Tìm theo tiêu đề hoặc tóm tắt…"
              value={search}
              onChange={(event) => {
                const nextSearch = event.target.value
                if (nextSearch.trim() !== debounced || currentPage !== 1) {
                  setLoading(true)
                  setCurrentPage(1)
                }
                setError('')
                setSearch(nextSearch)
              }}
            />
          </label>
          <label className={styles.statusFilter}>
            <span className={styles.srOnly}>Lọc theo trạng thái</span>
            <select
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(event) => {
                const nextStatus = event.currentTarget.value
                if (nextStatus !== 'all' && nextStatus !== 'DRAFT' && nextStatus !== 'PUBLISHED') return
                setError('')
                setLoading(true)
                setStatus(nextStatus)
                setCurrentPage(1)
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã xuất bản</option>
            </select>
          </label>
          <button className={`${adminStyles.buttonQuiet} ${styles.clearButton}`} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>

        {renderPagination('top')}
        {error && (
          <p className={adminStyles.formMessage} role="alert">
            {error} <button className={adminStyles.textLink} type="button" onClick={retryList}>Thử lại</button>
          </p>
        )}
        {loading ? (
          <div className={styles.loadingState} aria-live="polite">Đang tải dữ liệu…</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>{error ? 'Không thể tải danh sách' : 'Chưa có bài viết phù hợp'}</h2>
            <p>{error ? 'Kiểm tra kết nối rồi thử tải lại danh sách tin tức.' : 'Tạo tin tức mới hoặc xóa bộ lọc.'}</p>
          </div>
        ) : (
          <div className={styles.tableWrap} role="region" aria-label="Bảng tin tức" tabIndex={0}>
            <table className={styles.newsTable}>
              <thead>
                <tr>
                  <th scope="col">TIÊU ĐỀ</th>
                  <th scope="col">DANH MỤC</th>
                  <th scope="col">TRẠNG THÁI</th>
                  <th scope="col">XUẤT BẢN</th>
                  <th scope="col">CẬP NHẬT</th>
                  <th scope="col">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className={styles.articleTitle} to={`/admin/news/${item.id}/edit`}>{item.title}</Link>
                      <span className={styles.articleSummary}>{item.summary}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span className={`${adminStyles.badge} ${adminStyles[item.status === 'PUBLISHED' ? 'status_published' : 'status_draft']} ${styles.statusBadge}`}>
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td className={styles.dateCell}>{formatDateTime(item.publishedAt)}</td>
                    <td className={styles.dateCell}>{formatDateTime(item.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link className={`${adminStyles.iconButton} ${styles.actionButton}`} aria-label={`Chỉnh sửa ${item.title}`} to={`/admin/news/${item.id}/edit`}>
                          <AdminIcon name="edit" size={15} /> Sửa
                        </Link>
                        {item.status === 'PUBLISHED' && (
                          <Link className={`${adminStyles.iconButton} ${styles.actionButton}`} to={`/news/${encodeURIComponent(item.slug)}`} target="_blank" rel="noopener">
                            <AdminIcon name="eye" size={15} /> Xem
                          </Link>
                        )}
                        {item.status === 'DRAFT' ? (
                          <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" onClick={() => setPending({ article: item as NewsArticle, action: 'publish' })}>
                            <Send size={14} aria-hidden="true" /> Xuất bản
                          </button>
                        ) : (
                          <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" onClick={() => setPending({ article: item as NewsArticle, action: 'unpublish' })}>
                            <EyeOff size={14} aria-hidden="true" /> Gỡ xuất bản
                          </button>
                        )}
                        <button
                          className={`${adminStyles.iconButton} ${adminStyles.iconButtonDanger} ${styles.actionButton}`}
                          type="button"
                          aria-label={`Xóa ${item.title}`}
                          onClick={() => setPending({ article: item as NewsArticle, action: 'delete' })}
                        >
                          <AdminIcon name="trash" size={14} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {renderPagination('bottom')}
      </section>
      {pending && (
        <ConfirmDialog
          title={pending.action === 'delete' ? 'Xóa bài viết?' : pending.action === 'publish' ? 'Xuất bản bài viết?' : 'Gỡ xuất bản?'}
          description={
            pending.action === 'delete'
              ? `“${pending.article.title}” sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.`
              : pending.action === 'publish'
                ? `“${pending.article.title}” sẽ hiển thị công khai cho mọi người.`
                : `“${pending.article.title}” sẽ trở về bản nháp và không còn hiển thị công khai.`
          }
          confirmLabel={pending.action === 'delete' ? 'Xóa bài viết' : pending.action === 'publish' ? 'Xuất bản' : 'Gỡ xuất bản'}
          danger={pending.action === 'delete'}
          busy={saving}
          error={dialogError}
          onConfirm={() => void complete()}
          onCancel={() => { if (!saving) { setPending(null); setDialogError('') } }}
        />
      )}
    </main>
  )
}

function MetricCard({
  label,
  value,
  loading,
  tone,
  icon: Icon,
}: {
  label: string
  value: number | string | undefined
  loading: boolean
  tone: MetricTone
  icon: LucideIcon
}) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString('vi-VN') : value ?? '—'

  return (
    <article className={styles.metricCard}>
      <span className={`${styles.metricIcon} ${styles[tone]}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <p>{label}</p>
      {loading ? <span className={styles.metricSkeleton} aria-hidden="true" /> : <strong>{formattedValue}</strong>}
    </article>
  )
}

export default AdminNewsPage
