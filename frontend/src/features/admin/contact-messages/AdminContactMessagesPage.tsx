import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Mail, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AdminIcon } from '../components/AdminIcons'
import { useAdmin } from '../useAdmin'
import { formatDateTime } from '../../community/format'
import { ContactMessageCategoryBadge } from './ContactMessageCategoryBadge'
import { reportTypeLabels } from './report-type-labels'
import { ContactMessageStatusBadge } from './ContactMessageStatusBadge'
import type {
  ContactMessage,
  ContactMessageCategory,
  ContactMessageListState,
  ContactMessageRouteState,
  ContactMessageStatus,
} from './contact-messages.types'
import {
  getAdminContactMessage,
  getContactApiErrorMessage,
  listAdminContactMessages,
  toContactMessage,
  updateAdminContactMessageStatus,
  type ContactMessageDetailsResponse,
} from '../../contact/contact-api'
import styles from '../admin.module.css'
import pageStyles from './AdminContactMessagesPage.module.css'

const pageSizes = [10, 20, 50] as const
type PageSize = (typeof pageSizes)[number]

const statusOptions: Array<{ value: ContactMessageStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'NEW', label: 'Mới' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
]

const categoryOptions: Array<{ value: ContactMessageCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'CONTACT', label: 'Liên hệ' },
  { value: 'PROBLEM_REPORT', label: 'Báo cáo vấn đề' },
]

function ContactMessageDrawer({
  messageId,
  request,
  onClose,
  onSave,
}: {
  messageId: string
  request: ReturnType<typeof useAdmin>['request']
  onClose: () => void
  onSave: (id: string, status: ContactMessageStatus) => Promise<void>
}) {
  const [loaded, setLoaded] = useState<{
    messageId: string
    details: ContactMessageDetailsResponse | null
    error: string
  } | null>(null)
  const currentLoad = loaded?.messageId === messageId ? loaded : null
  const details = currentLoad?.details ?? null
  const loading = currentLoad === null
  const loadError = currentLoad?.error ?? ''
  const [actionError, setActionError] = useState('')
  const [status, setStatus] = useState<ContactMessageStatus>('NEW')
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getAdminContactMessage(request, messageId, controller.signal)
      .then((response) => {
        setLoaded({ messageId, details: response, error: '' })
        setStatus(response.status)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({
            messageId,
            details: null,
            error: getContactApiErrorMessage(error, 'Không thể tải chi tiết yêu cầu.'),
          })
        }
      })
    return () => controller.abort()
  }, [messageId, request])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )
    const first = controls.item(0)
    const last = controls.item(controls.length - 1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className={pageStyles.drawerBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={pageStyles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-message-detail-title"
        onKeyDown={handleKeyDown}
      >
        <header className={pageStyles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>CHI TIẾT YÊU CẦU</p>
            <h2 id="contact-message-detail-title">Tin nhắn liên hệ</h2>
          </div>
          <button
            ref={closeRef}
            className={styles.iconButton}
            type="button"
            aria-label="Đóng chi tiết tin nhắn"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <dl className={pageStyles.detailList}>
          {loading && <div role="status">Đang tải chi tiết yêu cầu...</div>}
          {loadError && <div role="alert">{loadError}</div>}
          {details && (
            <>
              <div>
                <dt>Người gửi</dt>
                <dd>{details.fullName}</dd>
              </div>
              {details.username && (
                <div>
                  <dt>Username</dt>
                  <dd>{details.username}</dd>
                </div>
              )}
              <div>
                <dt>Email</dt>
                <dd><a href={`mailto:${details.email}`}>{details.email}</a></dd>
              </div>
              {details.category === 'PROBLEM_REPORT' && (
                <>
                  <div>
                    <dt>Loại yêu cầu</dt>
                    <dd><ContactMessageCategoryBadge category="PROBLEM_REPORT" /></dd>
                  </div>
                  <div>
                    <dt>Bài tập</dt>
                    <dd>
                      {details.problemId && details.problemCode ? (
                        <Link to={`/problems/${encodeURIComponent(details.problemCode)}`} target="_blank" rel="noreferrer">
                          {details.problemCode} – {details.problemTitle}
                        </Link>
                      ) : `${details.problemCode ?? ''} – ${details.problemTitle ?? ''} (đã xóa)`}
                    </dd>
                  </div>
                  <div>
                    <dt>Loại vấn đề</dt>
                    <dd>{reportTypeLabels[details.reportType ?? ''] ?? details.reportType}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Tiêu đề</dt>
                <dd>{details.subject}</dd>
              </div>
              <div>
                <dt>Ngày gửi</dt>
                <dd>{formatDateTime(details.createdAt)}</dd>
              </div>
              <div className={pageStyles.messageContent}>
                <dt>Nội dung</dt>
                <dd>{details.content}</dd>
              </div>
            </>
          )}
        </dl>

        {details && <div className={pageStyles.statusEditor}>
          <label htmlFor="contact-message-status">Trạng thái</label>
          <div className={pageStyles.statusCurrent}>
            <ContactMessageStatusBadge status={details.status} />
          </div>
          <select
            id="contact-message-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ContactMessageStatus)}
            disabled={saving}
          >
            {statusOptions.filter((option) => option.value !== 'all').map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>}

        <footer className={pageStyles.drawerActions}>
          <p>{actionError || 'Thay đổi sẽ được lưu vào hệ thống.'}</p>
          <div>
            <button className={styles.buttonSecondary} type="button" onClick={onClose}>Đóng</button>
            <button
              className={styles.buttonPrimary}
              type="button"
              disabled={!details || loading || saving}
              onClick={async () => {
                if (!details) return
                setSaving(true)
                setActionError('')
                try {
                  await onSave(details.id, status)
                } catch (error) {
                  setActionError(getContactApiErrorMessage(error, 'Không thể lưu trạng thái.'))
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Đang lưu...' : 'Lưu trạng thái'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function AdminContactMessagesPage() {
  const { request, setNotice } = useAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as ContactMessageRouteState | null
  const initialListState = routeState?.listState
  const [search, setSearch] = useState(initialListState?.search ?? '')
  const [statusFilter, setStatusFilter] = useState<ContactMessageStatus | 'all'>(initialListState?.statusFilter ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState<ContactMessageCategory | 'all'>(initialListState?.categoryFilter ?? 'all')
  const [page, setPage] = useState(initialListState?.page ?? 1)
  const [pageSize, setPageSize] = useState<PageSize>(initialListState?.pageSize ?? 10)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [data, setData] = useState<{
    key: string
    response: Awaited<ReturnType<typeof listAdminContactMessages>>
  } | null>(null)
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const queryKey = JSON.stringify([search.trim(), statusFilter, categoryFilter, page, pageSize, refreshVersion])
  const visibleData = data?.key === queryKey ? data.response : null
  const visibleError = loadError?.key === queryKey ? loadError.message : ''
  const loading = !visibleData && !visibleError
  const counts = visibleData?.statistics ?? { total: 0, NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 }
  const messages = visibleData?.items.map(toContactMessage) ?? []
  const total = visibleData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)
  const hasFilters = Boolean(search.trim()) || statusFilter !== 'all' || categoryFilter !== 'all'
  const firstItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, total)

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void listAdminContactMessages(request, {
        page,
        pageSize,
        q: search.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      }, controller.signal      )
        .then((response) => {
          const lastPage = Math.max(1, Math.ceil(response.total / pageSize))
          if (page > lastPage) {
            setPage(lastPage)
            return
          }
          setData({ key: queryKey, response })
          setLoadError(null)
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setLoadError({
              key: queryKey,
              message: getContactApiErrorMessage(error, 'Không thể tải danh sách yêu cầu.'),
            })
          }
        })
    }, search.trim() ? 250 : 0)
    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [categoryFilter, page, pageSize, queryKey, refreshVersion, request, search, statusFilter])

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setPage(1)
  }

  function openMessage(message: ContactMessage, trigger: HTMLElement) {
    returnFocusRef.current = trigger
    setSelectedId(message.id)
  }

  function openMessageDetails(message: ContactMessage) {
    const listState: ContactMessageListState = {
      search,
      statusFilter,
      categoryFilter,
      page: currentPage,
      pageSize,
    }
    navigate(`/admin/contact-messages/${encodeURIComponent(message.id)}`, {
      state: { listState } satisfies ContactMessageRouteState,
    })
  }

  function closeDrawer() {
    setSelectedId(null)
    window.requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  async function saveStatus(id: string, status: ContactMessageStatus) {
    await updateAdminContactMessageStatus(request, id, status)
    setNotice('Đã cập nhật trạng thái yêu cầu.')
    setRefreshVersion((value) => value + 1)
    setSelectedId(null)
    window.requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>HỖ TRỢ NGƯỜI DÙNG</p>
          <h1>Quản lý liên hệ</h1>
          <p className={styles.pageSubtitle}>Tiếp nhận và quản lý các yêu cầu hỗ trợ từ người dùng.</p>
        </div>
      </div>
      <section className={styles.metricGrid} aria-label="Thống kê tin nhắn liên hệ">
        <Metric label="Tổng tin nhắn" value={counts.total} tone="total" />
        <Metric label="Tin nhắn mới" value={counts.NEW} tone="new" />
        <Metric label="Đang xử lý" value={counts.IN_PROGRESS} tone="progress" />
        <Metric label="Đã xử lý" value={counts.RESOLVED} tone="resolved" />
      </section>

      <section className={styles.panel} aria-label="Danh sách tin nhắn liên hệ">
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <AdminIcon name="search" size={18} />
            <input
              aria-label="Tìm theo tên, email, tiêu đề hoặc mã bài tập"
              placeholder="Tìm theo tên, email, tiêu đề, mã bài tập..."
              value={search}
              maxLength={200}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
            aria-label="Lọc tin nhắn theo trạng thái"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as ContactMessageStatus | 'all')
              setPage(1)
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Lọc tin nhắn theo loại yêu cầu"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value as ContactMessageCategory | 'all')
              setPage(1)
            }}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button className={styles.buttonQuiet} type="button" onClick={clearFilters} disabled={!hasFilters}>
            Đặt lại
          </button>
        </div>

        <div className={pageStyles.resultsBar} aria-live="polite">
          Hiển thị <strong>{firstItem}–{lastItem}</strong> trên <strong>{total}</strong> tin nhắn
        </div>

        {loading && !visibleData ? (
          <div className={styles.emptyState} role="status"><h2>Đang tải yêu cầu liên hệ...</h2></div>
        ) : visibleError ? (
          <div className={styles.emptyState} role="alert">
            <h2>Không thể tải yêu cầu liên hệ</h2>
            <p>{visibleError}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Mail size={24} aria-hidden="true" />
            <h2>{hasFilters ? 'Không tìm thấy tin nhắn phù hợp' : 'Chưa có tin nhắn liên hệ'}</h2>
            {hasFilters && <p>Thử từ khóa khác hoặc đặt lại bộ lọc.</p>}
          </div>
        ) : (
          <div className={`${styles.tableWrap} ${pageStyles.tableWrap}`}>
            <table className={pageStyles.messageTable}>
              <thead>
                <tr>
                  <th scope="col" className={pageStyles.numberColumn}>STT</th>
                  <th scope="col">NGƯỜI GỬI</th>
                  <th scope="col">TIÊU ĐỀ</th>
                  <th scope="col">NGÀY GỬI</th>
                  <th scope="col">TRẠNG THÁI</th>
                  <th scope="col">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message, index) => (
                  <tr key={message.id}>
                    <td className={pageStyles.numberCell}>
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td>
                      <strong className={pageStyles.senderName}>{message.username ?? message.fullName}</strong>
                      <span className={pageStyles.senderEmail}>{message.email}</span>
                    </td>
                    <td className={pageStyles.subjectCell}>
                      <ContactMessageCategoryBadge category={message.category} />
                      <button
                        type="button"
                        className={pageStyles.subjectButton}
                        onClick={(event) => openMessage(message, event.currentTarget)}
                        title={message.subject}
                      >
                        {message.subject}
                      </button>
                      {message.category === 'PROBLEM_REPORT' && (
                        <span className={pageStyles.problemRef}>
                          {message.problemCode} – {message.problemTitle}
                        </span>
                      )}
                    </td>
                    <td className={pageStyles.dateCell}>{formatDateTime(message.createdAt)}</td>
                    <td><ContactMessageStatusBadge status={message.status} /></td>
                    <td>
                      <button
                        className={styles.iconButton}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openMessageDetails(message)
                        }}
                        aria-label={`Xem chi tiết tin nhắn của ${message.fullName}`}
                      >
                        <AdminIcon name="eye" size={15} />
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={pageStyles.pagination}>
          <label className={pageStyles.pageSize}>
            <span>Mỗi trang</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as PageSize)
                setPage(1)
              }}
            >
              {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <nav className={pageStyles.pageControls} aria-label="Phân trang tin nhắn liên hệ">
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Trang trước
            </button>
            <span aria-live="polite">Trang {currentPage} / {pageCount}</span>
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              Trang sau
            </button>
          </nav>
        </div>
      </section>

      {selectedId && (
        <ContactMessageDrawer
          key={selectedId}
          messageId={selectedId}
          request={request}
          onClose={closeDrawer}
          onSave={saveStatus}
        />
      )}
    </>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'total' | 'new' | 'progress' | 'resolved'
}) {
  return (
    <article className={styles.metricCard}>
      <span className={`${styles.metricMark} ${pageStyles[`metric_${tone}`]}`} />
      <p>{label}</p>
      <strong>{value.toLocaleString('vi-VN')}</strong>
      <small>Từ hệ thống</small>
    </article>
  )
}

export default AdminContactMessagesPage
