import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { buildQuery, type NewsArticle, type NewsStatus, type PageResult } from '../../community/api'
import { formatDateTime, totalPages } from '../../community/format'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import styles from '../admin.module.css'

type Pending = { article: NewsArticle; action: 'publish' | 'unpublish' | 'delete' }
type ListItem = Omit<NewsArticle, 'content'>

const PAGE_SIZE = 20
const statusLabels: Record<NewsStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản' }

function AdminNewsPage() {
  const { request, setNotice } = useAdmin()
  const [page, setPage] = useState<PageResult<ListItem> | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState<NewsStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pending, setPending] = useState<Pending | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const fetchPage = useCallback(
    () =>
      request<PageResult<ListItem>>(
        `/admin/news${buildQuery({ page: currentPage, pageSize: PAGE_SIZE, q: debounced, status: status === 'all' ? undefined : status })}`,
      ),
    [currentPage, debounced, request, status],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchPage()
      .then((data) => {
        if (active) setPage(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách tin tức.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchPage, reloadKey])

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
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setDialogError(cause instanceof ApiError ? cause.message : 'Không thể lưu thay đổi.')
    } finally {
      setSaving(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setDebounced('')
    setStatus('all')
    setCurrentPage(1)
  }

  const items = page?.items ?? []
  const pageCount = totalPages(page?.total ?? 0, PAGE_SIZE)

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>NỘI DUNG CỘNG ĐỒNG</p>
          <h1>Quản lý tin tức</h1>
          <p className={styles.pageSubtitle}>Soạn, xuất bản và quản lý tin tức chính thức hiển thị tại Góc cộng đồng.</p>
        </div>
        <Link className={styles.buttonPrimary} to="/admin/news/new"><AdminIcon name="plus" /> Tạo tin tức</Link>
      </div>
      <section className={styles.panel} aria-label="Danh sách tin tức" aria-busy={loading}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <AdminIcon name="search" size={18} />
            <input
              aria-label="Tìm theo tiêu đề hoặc tóm tắt"
              placeholder="Tìm theo tiêu đề hoặc tóm tắt…"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }}
            />
          </label>
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(event) => { setStatus(event.target.value as NewsStatus | 'all'); setCurrentPage(1) }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
          </select>
          <button className={styles.buttonQuiet} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
        {error && (
          <p className={styles.formMessage} role="alert">
            {error} <button className={styles.textLink} type="button" onClick={() => setReloadKey((value) => value + 1)}>Thử lại</button>
          </p>
        )}
        <p className={styles.fieldHint} aria-live="polite">Hiển thị {items.length} / {page?.total ?? 0} bài viết</p>
        {loading ? (
          <p className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</p>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>{error ? 'Không thể tải danh sách' : 'Chưa có bài viết phù hợp'}</h2>
            <p>Tạo tin tức mới hoặc xóa bộ lọc.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.problemTable}>
              <thead>
                <tr>
                  <th scope="col">Tiêu đề</th><th scope="col">Danh mục</th><th scope="col">Trạng thái</th>
                  <th scope="col">Xuất bản</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className={styles.problemTitle} to={`/admin/news/${item.id}/edit`}>{item.title}</Link>
                      <span className={styles.problemSummary}>{item.summary}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span className={`${styles.badge} ${item.status === 'PUBLISHED' ? styles.status_published : styles.status_draft}`}>
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(item.publishedAt)}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link className={styles.iconButton} aria-label={`Chỉnh sửa ${item.title}`} to={`/admin/news/${item.id}/edit`}>
                          <AdminIcon name="edit" size={15} /> Sửa
                        </Link>
                        {item.status === 'PUBLISHED' && (
                          <Link className={styles.iconButton} to={`/news/${encodeURIComponent(item.slug)}`} target="_blank" rel="noopener">
                            <AdminIcon name="eye" size={15} /> Xem
                          </Link>
                        )}
                        {item.status === 'DRAFT' ? (
                          <button className={styles.iconButton} type="button" onClick={() => setPending({ article: item as NewsArticle, action: 'publish' })}>Xuất bản</button>
                        ) : (
                          <button className={styles.iconButton} type="button" onClick={() => setPending({ article: item as NewsArticle, action: 'unpublish' })}>Gỡ xuất bản</button>
                        )}
                        <button
                          className={`${styles.iconButton} ${styles.iconButtonDanger}`}
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
        <div className={styles.rowActions}>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage((value) => value - 1)}>Trang trước</button>
          <span aria-live="polite">Trang {currentPage} / {pageCount}</span>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage >= pageCount || loading} onClick={() => setCurrentPage((value) => value + 1)}>Trang sau</button>
        </div>
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
    </>
  )
}

export default AdminNewsPage
