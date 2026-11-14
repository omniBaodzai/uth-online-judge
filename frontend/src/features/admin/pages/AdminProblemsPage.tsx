import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { ApiError } from '../../auth/api'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { useAdmin } from '../useAdmin'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatDate, statusLabels } from '../utils'
import type { AdminDashboard, AdminProblem, AdminProblemPage, AdminProblemStatus } from '../types'
import styles from './AdminProblemsPage.module.css'

type PendingAction = { problem: AdminProblem; status: AdminProblemStatus | 'delete' | 'hide' | 'show' }
type MetricTone = 'teal' | 'green' | 'amber' | 'slate'
const PAGE_SIZE_OPTIONS = submissionPageSizes
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSize = 20

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof ApiError ? cause.message : fallback
}

function visibilityErrorMessage(cause: unknown) {
  if (!(cause instanceof ApiError)) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
  }
  if (cause.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (cause.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (cause.status === 404) return 'Không tìm thấy bài tập. Danh sách có thể đã thay đổi; vui lòng tải lại.'
  if (cause.status === 409) {
    return cause.message || 'Bài tập đang có thay đổi xung đột. Vui lòng thử lại sau.'
  }
  if (cause.status === 0) {
    return cause.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
  }
  if (cause.status >= 500) {
    return 'Máy chủ chưa thể cập nhật trạng thái hiển thị. Vui lòng thử lại sau.'
  }
  return cause.message || 'Không thể cập nhật trạng thái hiển thị. Vui lòng thử lại.'
}

function isProblemStatus(value: string): value is AdminProblemStatus {
  return value === 'draft' || value === 'published' || value === 'archived'
}

function AdminProblemsPage() {
  const { request, setNotice } = useAdmin()
  const [page, setPage] = useState<AdminProblemPage | null>(null)
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminProblemStatus | 'all'>('all')
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [pendingError, setPendingError] = useState('')
  const [loading, setLoading] = useState(true)
  const [countsLoading, setCountsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [countsError, setCountsError] = useState('')

  const fetchPage = useCallback(() => {
    const query = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) })
    if (search.trim()) query.set('search', search.trim())
    if (status !== 'all') query.set('status', status)
    if (visibility !== 'all') query.set('visibility', visibility)
    return request<AdminProblemPage>(`/admin/problems?${query.toString()}`)
  }, [currentPage, pageSize, request, search, status, visibility])

  const fetchDashboard = useCallback(
    () => request<AdminDashboard>('/admin/dashboard'),
    [request],
  )

  const refreshCounts = useCallback(async () => {
    setCountsLoading(true)
    setCountsError('')
    try {
      setDashboard(await fetchDashboard())
    } catch (cause) {
      setCountsError(errorMessage(cause, 'Không thể tải số liệu bài tập.'))
    } finally {
      setCountsLoading(false)
    }
  }, [fetchDashboard])

  useEffect(() => {
    let active = true
    let clamped = false
    fetchPage()
      .then((data) => {
        if (active) {
          const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
          if (currentPage > lastPage) {
            clamped = true
            setCurrentPage(lastPage)
            return
          }
          setPage(data)
          setError('')
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause, 'Không thể tải danh sách bài tập.'))
      })
      .finally(() => {
        if (active && !clamped) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentPage, fetchPage, listRefreshKey, pageSize])

  useEffect(() => {
    let active = true
    fetchDashboard()
      .then((data) => {
        if (active) {
          setDashboard(data)
          setCountsError('')
        }
      })
      .catch((cause: unknown) => {
        if (active) setCountsError(errorMessage(cause, 'Không thể tải số liệu bài tập.'))
      })
      .finally(() => {
        if (active) setCountsLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchDashboard])

  function clearFilters() {
    if (search || status !== 'all' || visibility !== 'all' || currentPage !== 1) setLoading(true)
    setError('')
    setSearch('')
    setStatus('all')
    setVisibility('all')
    setCurrentPage(1)
  }

  function openAction(action: PendingAction) {
    setPendingError('')
    setPending(action)
  }

  async function completeAction() {
    if (!pending || savingRef.current) return
    if (pending.status === 'delete' && pending.problem.status !== 'draft') {
      setPendingError('API hiện chỉ cho phép xóa bài tập ở trạng thái bản nháp.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setPendingError('')
    const { problem, status: next } = pending
    try {
      if (next === 'delete') {
        await request<void>(`/admin/problems/${problem.id}`, { method: 'DELETE' })
        setNotice(`Đã xóa bài tập “${problem.code}”.`)
      } else if (next === 'hide' || next === 'show') {
        const isHidden = next === 'hide'
        const result = await request<{ id: string; status: AdminProblemStatus; isHidden: boolean }>(
          `/admin/problems/${problem.id}/visibility`,
          { method: 'PATCH', body: JSON.stringify({ isHidden }) },
        )
        if (result.status !== 'published' || result.isHidden !== isHidden) {
          throw new Error('Phản hồi trạng thái hiển thị không khớp. Vui lòng tải lại danh sách trước khi thử lại.')
        }
        setNotice(isHidden
          ? `Đã ẩn “${problem.code}” khỏi danh sách bài tập công khai.`
          : `Đã hiển thị lại “${problem.code}” trong danh sách bài tập công khai.`)
      } else {
        await request<AdminProblem>(`/admin/problems/${problem.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        })
        const action = problem.status === 'archived' ? 'khôi phục' : 'cập nhật'
        setNotice(`Đã ${action} “${problem.code}” sang trạng thái ${statusLabels[next]}.`)
      }
      setPending(null)
      setPendingError('')
      setLoading(true)
      setListRefreshKey((value) => value + 1)
      if (next !== 'hide' && next !== 'show') await refreshCounts()
    } catch (cause) {
      setPendingError(next === 'hide' || next === 'show'
        ? visibilityErrorMessage(cause)
        : errorMessage(cause, 'Không thể lưu thay đổi. Vui lòng thử lại.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const problems = page?.items ?? []
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize))
  const hasFilters = Boolean(search.trim()) || status !== 'all' || visibility !== 'all'
  const counts = dashboard

  function changePage(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages) return
    setError('')
    setLoading(true)
    setCurrentPage(nextPage)
  }

  function changePageSize(value: number) {
    const nextPageSize = PAGE_SIZE_OPTIONS.find((option) => option === value)
    if (!nextPageSize || nextPageSize === pageSize) return
    setError('')
    setLoading(true)
    setCurrentPage(1)
    setPageSize(nextPageSize)
  }

  function retryList() {
    setError('')
    setLoading(true)
    setListRefreshKey((value) => value + 1)
  }

  function renderPagination(placement: 'top' | 'bottom') {
    if (!page || page.total === 0) return null
    return (
      <div className={placement === 'top' ? styles.paginationTop : styles.paginationBottom}>
        <SubmissionPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={page.total}
          pageSizes={PAGE_SIZE_OPTIONS}
          label="bài tập"
          summaryLabel="bài tập"
          showPageSize={placement === 'bottom'}
          disabled={loading}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </div>
    )
  }

  return (
    <main className={styles.page} aria-busy={loading}>
      <section className={styles.metrics} aria-label="Tổng quan bài tập" aria-busy={countsLoading}>
        <MetricCard
          label="Tổng bài tập"
          value={counts?.total}
          loading={countsLoading && !counts}
          tone="teal"
          icon={BookOpen}
        />
        <MetricCard
          label="Đã xuất bản"
          value={counts?.published}
          loading={countsLoading && !counts}
          tone="green"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Bản nháp"
          value={counts?.draft}
          loading={countsLoading && !counts}
          tone="amber"
          icon={FileText}
        />
        <MetricCard
          label="Đã lưu trữ"
          value={counts?.archived}
          loading={countsLoading && !counts}
          tone="slate"
          icon={Archive}
        />
      </section>

      {countsError && (
        <div className={styles.countsError} role="alert">
          <span>{countsError}</span>
          <button type="button" onClick={() => void refreshCounts()} disabled={countsLoading}>
            Thử tải lại
          </button>
        </div>
      )}

      <div className={styles.createRow}>
        <Link className={styles.createButton} to="/admin/problems/new">
          <Plus size={18} aria-hidden="true" />
          Tạo bài tập
        </Link>
      </div>

      <section className={styles.listPanel} aria-label="Danh sách bài tập" aria-busy={loading}>
        <div className={styles.filters}>
          <label className={styles.searchBox}>
            <Search size={18} aria-hidden="true" />
            <span className={styles.srOnly}>Tìm theo mã hoặc tên bài tập</span>
            <input
              aria-label="Tìm theo mã hoặc tên bài tập"
              placeholder="Tìm theo mã hoặc tên bài tập…"
              value={search}
              onChange={(event) => {
                setLoading(true)
                setError('')
                setSearch(event.currentTarget.value)
                setCurrentPage(1)
              }}
            />
          </label>
          <label className={styles.statusFilter}>
            <span className={styles.srOnly}>Lọc theo trạng thái</span>
            <select
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(event) => {
                const next = event.currentTarget.value
                if (next !== 'all' && !isProblemStatus(next)) return
                setLoading(true)
                setError('')
                setStatus(next)
                setCurrentPage(1)
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </label>
          <label className={styles.visibilityFilter}>
            <span className={styles.srOnly}>Lọc theo hiển thị công khai</span>
            <select
              aria-label="Lọc theo hiển thị công khai"
              value={visibility}
              onChange={(event) => {
                const next = event.currentTarget.value
                if (next !== 'all' && next !== 'visible' && next !== 'hidden') return
                setLoading(true)
                setError('')
                setVisibility(next)
                setCurrentPage(1)
              }}
            >
              <option value="all">Tất cả hiển thị</option>
              <option value="visible">Đang hiển thị</option>
              <option value="hidden">Đang ẩn</option>
            </select>
          </label>
          <button className={styles.clearButton} type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>

        {renderPagination('top')}

        {error && (
          <div className={styles.listError} role="alert">
            <span>{error}</span>
            <button type="button" onClick={retryList}>
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className={styles.skeletonList} aria-label="Đang tải danh sách bài tập">
            {Array.from({ length: 4 }, (_, index) => <div className={styles.rowSkeleton} key={index} />)}
          </div>
        ) : error && !page ? (
          <div className={styles.emptyState}>
            <h2>Không thể tải danh sách</h2>
            <p>Kiểm tra kết nối rồi thử tải lại danh sách bài tập.</p>
            <button className={styles.clearButton} type="button" onClick={retryList}>
              Thử tải lại
            </button>
          </div>
        ) : problems.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><Search size={22} aria-hidden="true" /></span>
            <h2>{hasFilters ? 'Không tìm thấy bài tập phù hợp' : 'Chưa có bài tập nào'}</h2>
            <p>{hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.' : 'Tạo bài tập đầu tiên để bắt đầu xây dựng kho nội dung.'}</p>
            {hasFilters ? (
              <button className={styles.clearButton} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
            ) : (
              <Link className={styles.emptyCreateLink} to="/admin/problems/new"><Plus size={16} aria-hidden="true" /> Tạo bài tập</Link>
            )}
          </div>
        ) : (
          <>
            <div className={styles.desktopTable}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">MÃ BÀI</th>
                    <th scope="col">TÊN BÀI</th>
                    <th scope="col">CHỦ ĐỀ</th>
                    <th scope="col">TRẠNG THÁI</th>
                    <th scope="col">CẬP NHẬT</th>
                    <th scope="col">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((problem) => (
                    <tr key={problem.id}>
                      <td><span className={styles.problemCode}>{problem.code}</span></td>
                      <td>
                        <Link className={styles.problemTitle} to={`/admin/problems/${problem.id}/edit`}>{problem.title}</Link>
                        {problem.summary && <span className={styles.problemSummary}>{problem.summary}</span>}
                      </td>
                      <td><TagList tags={problem.tags} /></td>
                      <td><StatusBadges status={problem.status} isHidden={problem.isHidden} /></td>
                      <td className={styles.dateCell}>{formatDate(problem.updatedAt)}</td>
                      <td><ProblemActions problem={problem} onAction={openAction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileList}>
              {problems.map((problem) => (
                <article className={styles.mobileCard} key={problem.id}>
                  <div className={styles.mobileCardTop}>
                    <span className={styles.problemCode}>{problem.code}</span>
                    <StatusBadges status={problem.status} isHidden={problem.isHidden} />
                  </div>
                  <Link className={styles.problemTitle} to={`/admin/problems/${problem.id}/edit`}>{problem.title}</Link>
                  {problem.summary && <p className={styles.problemSummary}>{problem.summary}</p>}
                  <TagList tags={problem.tags} />
                  <p className={styles.mobileDate}>Cập nhật {formatDate(problem.updatedAt)}</p>
                  <ProblemActions problem={problem} onAction={openAction} />
                </article>
              ))}
            </div>
          </>
        )}

        {renderPagination('bottom')}
      </section>

      {pending && (
        <ConfirmDialog
          title={pending.status === 'delete'
            ? 'Xóa bài tập?'
            : pending.status === 'hide'
              ? 'Ẩn bài tập khỏi danh sách?'
              : pending.status === 'show'
                ? 'Hiển thị lại bài tập?'
            : pending.status === 'published' && pending.problem.status === 'archived'
              ? 'Khôi phục bài tập?'
              : pending.status === 'published'
                ? 'Xuất bản bài tập?'
                : 'Lưu trữ bài tập?'}
          description={pending.status === 'delete'
            ? `“${pending.problem.code} — ${pending.problem.title}” sẽ bị xóa vĩnh viễn. Nếu bài đã có bài nộp hoặc đang được dùng trong kỳ thi, hệ thống sẽ từ chối xóa để giữ lịch sử. Một số dữ liệu phụ thuộc có thể bị xóa theo ràng buộc hiện hành.`
            : pending.status === 'hide'
              ? 'Bài tập sẽ không còn xuất hiện trong danh sách bài tập công khai. Người có đường dẫn trực tiếp vẫn có thể xem đề và nộp bài bình thường. Bạn có muốn tiếp tục?'
              : pending.status === 'show'
                ? 'Bài tập sẽ xuất hiện trở lại trong danh sách bài tập công khai. Bạn có muốn tiếp tục?'
            : `Xác nhận chuyển “${pending.problem.code} — ${pending.problem.title}” sang trạng thái ${statusLabels[pending.status]}?`}
          confirmLabel={pending.status === 'delete'
            ? 'Xóa vĩnh viễn'
            : pending.status === 'hide'
              ? 'Ẩn khỏi danh sách'
              : pending.status === 'show'
                ? 'Hiển thị lại'
            : pending.status === 'published' && pending.problem.status === 'archived'
              ? 'Khôi phục bài tập'
              : pending.status === 'published'
                ? 'Xuất bản'
                : 'Lưu trữ'}
          danger={pending.status === 'delete'}
          busy={saving}
          error={pendingError}
          onConfirm={() => void completeAction()}
          onCancel={() => {
            if (!saving) {
              setPending(null)
              setPendingError('')
            }
          }}
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
  value?: number
  loading: boolean
  tone: MetricTone
  icon: LucideIcon
}) {
  return (
    <article className={styles.metricCard}>
      <span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={19} aria-hidden="true" /></span>
      <p>{label}</p>
      {loading ? <span className={styles.metricSkeleton} aria-hidden="true" /> : <strong>{value === undefined ? '—' : formatNumber(value)}</strong>}
    </article>
  )
}

function TagList({ tags }: { tags: string[] }) {
  return tags.length ? (
    <div className={styles.tagList} aria-label={`Chủ đề: ${tags.join(', ')}`}>
      {tags.slice(0, 3).map((tag) => <span className={styles.tag} key={tag}>{tag}</span>)}
      {tags.length > 3 && <span className={styles.moreTags}>+{tags.length - 3}</span>}
    </div>
  ) : <span className={styles.noTags}>Chưa gắn chủ đề</span>
}

function StatusBadge({ status }: { status: AdminProblemStatus }) {
  return <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{statusLabels[status]}</span>
}

function StatusBadges({ status, isHidden }: { status: AdminProblemStatus; isHidden: boolean }) {
  return (
    <div className={styles.statusBadges} role="group" aria-label="Trạng thái bài tập">
      <StatusBadge status={status} />
      {status === 'published' && isHidden && (
        <span className={`${styles.statusBadge} ${styles.status_hidden}`}>Đang ẩn</span>
      )}
    </div>
  )
}

function ProblemActions({
  problem,
  onAction,
}: {
  problem: AdminProblem
  onAction: (action: PendingAction) => void
}) {
  const canDelete = problem.status === 'draft'
  const deleteHint = canDelete
    ? `Xóa bài tập ${problem.code}`
    : 'Backend hiện chỉ cho phép xóa bài tập ở trạng thái bản nháp.'

  return (
    <div className={styles.rowActions} role="group" aria-label={`Thao tác cho ${problem.code}`}>
      <Link
        className={styles.actionButton}
        aria-label={`Sửa ${problem.code}`}
        title={`Sửa ${problem.code}`}
        to={`/admin/problems/${problem.id}/edit`}
      >
        <Pencil size={15} aria-hidden="true" /><span>Sửa</span>
      </Link>
      <Link
        className={styles.actionButton}
        aria-label={`Quản lý test case ${problem.code}`}
        title={`Quản lý test case ${problem.code}`}
        to={`/admin/problems/${problem.id}/test-cases`}
      >
        <FlaskConical size={15} aria-hidden="true" /><span>Test case</span>
      </Link>
      {problem.status === 'draft' && (
        <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="button" title="Xuất bản bài tập" onClick={() => onAction({ problem, status: 'published' })}>
          <Send size={14} aria-hidden="true" /><span>Xuất bản</span>
        </button>
      )}
      {problem.status === 'published' && (
        <>
          <button
            className={styles.actionButton}
            type="button"
            title="Lưu trữ bài tập"
            onClick={() => onAction({ problem, status: 'archived' })}
          >
            <Archive size={14} aria-hidden="true" /><span>Lưu trữ</span>
          </button>
          <button
            className={styles.actionButton}
            type="button"
            aria-label={`${problem.isHidden ? 'Hiện' : 'Ẩn'} ${problem.code} khỏi danh sách bài tập công khai`}
            title={problem.isHidden
              ? 'Hiện lại trong danh sách bài tập công khai'
              : 'Ẩn khỏi danh sách bài tập công khai; người có đường dẫn trực tiếp vẫn xem và nộp bài được'}
            onClick={() => onAction({ problem, status: problem.isHidden ? 'show' : 'hide' })}
          >
            {problem.isHidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
            <span>{problem.isHidden ? 'Hiện' : 'Ẩn'}</span>
          </button>
        </>
      )}
      {problem.status === 'archived' && (
        <button className={`${styles.actionButton} ${styles.actionPrimary}`} type="button" title="Khôi phục bài tập" onClick={() => onAction({ problem, status: 'published' })}>
          <RotateCcw size={14} aria-hidden="true" /><span>Khôi phục</span>
        </button>
      )}
      <button
        className={`${styles.actionButton} ${styles.actionDanger}`}
        type="button"
        disabled={!canDelete}
        aria-label={canDelete ? `Xóa ${problem.code}` : `Không thể xóa ${problem.code}: chỉ hỗ trợ bản nháp`}
        title={deleteHint}
        onClick={() => onAction({ problem, status: 'delete' })}
      >
        <Trash2 size={14} aria-hidden="true" /><span>Xóa</span>
      </button>
    </div>
  )
}

export default AdminProblemsPage
