import { useCallback, useEffect, useState } from 'react'
import {
  CircleCheck,
  Eye,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { UserDetailDialog } from '../components/UserDetailDialog'
import { formatDate, roleLabels } from '../utils'
import type { AdminUser, AdminUserPage, AdminUserRole, AdminUserStatus } from '../types'
import adminStyles from '../admin.module.css'
import styles from './AdminUsersPage.module.css'

type UserAction = 'promote' | 'demote' | 'activate' | 'deactivate'
type PendingAction = { user: AdminUser; action: UserAction }
type UserStats = { total: number; active: number; inactive: number; admins: number }
type MetricCardProps = {
  label: string
  value: number | undefined
  loading: boolean
  tone: 'teal' | 'green' | 'amber' | 'violet'
  icon: LucideIcon
}

const PAGE_SIZE_OPTIONS = submissionPageSizes
const DEFAULT_PAGE_SIZE = 20

const actionCopy: Record<UserAction, { title: string; confirm: string; danger: boolean; done: string; describe: (name: string) => string }> = {
  promote: {
    title: 'Cấp quyền Admin?',
    confirm: 'Cấp quyền Admin',
    danger: false,
    done: 'Đã cấp quyền Admin cho',
    describe: (name) => `“${name}” sẽ có toàn quyền quản trị bài tập, test case và người dùng.`,
  },
  demote: {
    title: 'Gỡ quyền Admin?',
    confirm: 'Gỡ quyền Admin',
    danger: true,
    done: 'Đã chuyển thành Học viên:',
    describe: (name) => `“${name}” sẽ trở lại vai trò Học viên và mất quyền truy cập khu vực quản trị.`,
  },
  activate: {
    title: 'Kích hoạt tài khoản?',
    confirm: 'Kích hoạt',
    danger: false,
    done: 'Đã kích hoạt tài khoản',
    describe: (name) => `“${name}” sẽ có thể đăng nhập và sử dụng hệ thống trở lại.`,
  },
  deactivate: {
    title: 'Vô hiệu hóa tài khoản?',
    confirm: 'Vô hiệu hóa',
    danger: true,
    done: 'Đã vô hiệu hóa tài khoản',
    describe: (name) => `“${name}” sẽ bị đăng xuất và không thể đăng nhập cho đến khi được kích hoạt lại.`,
  },
}

const displayName = (user: AdminUser) => user.fullName || user.username || user.email
const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : fallback

function AdminUsersPage() {
  const { request, setNotice } = useAdmin()
  const { user: currentUser } = useAuth()
  const [page, setPage] = useState<AdminUserPage | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<AdminUserRole | 'all'>('all')
  const [status, setStatus] = useState<AdminUserStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [listReloadKey, setListReloadKey] = useState(0)
  const [statsReloadKey, setStatsReloadKey] = useState(0)

  const fetchPage = useCallback(() => {
    const query = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (role !== 'all') query.set('role', role)
    if (status !== 'all') query.set('status', status)
    return request<AdminUserPage>(`/admin/users?${query.toString()}`)
  }, [currentPage, pageSize, request, role, search, status])

  useEffect(() => {
    let active = true
    let clamped = false
    fetchPage()
      .then((data) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (currentPage > lastPage) {
          clamped = true
          setCurrentPage(lastPage)
          return
        }
        setPage(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause, 'Không thể tải danh sách người dùng.'))
      })
      .finally(() => {
        if (active && !clamped) setLoading(false)
      })
    return () => { active = false }
  }, [currentPage, fetchPage, listReloadKey])

  useEffect(() => {
    let active = true
    const fetchCount = (filters: { role?: AdminUserRole; status?: AdminUserStatus }) => {
      const query = new URLSearchParams({ page: '1', pageSize: '1' })
      if (filters.role) query.set('role', filters.role)
      if (filters.status) query.set('status', filters.status)
      return request<AdminUserPage>(`/admin/users?${query.toString()}`)
    }

    Promise.all([
      fetchCount({}),
      fetchCount({ status: 'active' }),
      fetchCount({ status: 'inactive' }),
      fetchCount({ role: 'ADMIN' }),
    ])
      .then(([allUsers, activeUsers, inactiveUsers, admins]) => {
        if (active) {
          setStats({
            total: allUsers.total,
            active: activeUsers.total,
            inactive: inactiveUsers.total,
            admins: admins.total,
          })
          setStatsError('')
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setStats(null)
          setStatsError(errorMessage(cause, 'Không thể tải thống kê người dùng.'))
        }
      })
      .finally(() => {
        if (active) setStatsLoading(false)
      })
    return () => { active = false }
  }, [request, statsReloadKey])

  // Chờ người dùng ngừng gõ để tránh gọi API sau mỗi phím.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === search) return
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      setSearch(trimmed)
      setCurrentPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [search, searchInput])

  function changeFilter(apply: () => void) {
    setLoading(true)
    setError('')
    apply()
    setCurrentPage(1)
  }

  function clearFilters() {
    if (searchInput || search || role !== 'all' || status !== 'all' || currentPage !== 1) {
      setLoading(true)
      setError('')
    }
    setSearchInput('')
    setSearch('')
    setRole('all')
    setStatus('all')
    setCurrentPage(1)
  }

  function openAction(user: AdminUser, action: UserAction) {
    setActionError('')
    setPending({ user, action })
  }

  async function completeAction() {
    if (!pending) return
    const { user, action } = pending
    setSaving(true)
    setActionError('')
    try {
      const path = action === 'promote' || action === 'demote' ? 'role' : 'status'
      const body = path === 'role'
        ? { role: action === 'promote' ? 'ADMIN' : 'STUDENT' }
        : { isActive: action === 'activate' }
      await request<AdminUser>(`/admin/users/${user.id}/${path}`, { method: 'PATCH', body: JSON.stringify(body) })
      setNotice(`${actionCopy[action].done} “${displayName(user)}”.`)
      setPending(null)
      setLoading(true)
      setError('')
      setListReloadKey((value) => value + 1)
      setStats(null)
      setStatsLoading(true)
      setStatsError('')
      setStatsReloadKey((value) => value + 1)
    } catch (cause) {
      setActionError(errorMessage(cause, 'Không thể cập nhật người dùng. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const users = page?.items ?? []
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize))
  const filtered = Boolean(search || role !== 'all' || status !== 'all')

  function changePage(nextPage: number) {
    if (loading || nextPage < 1 || nextPage > totalPages) return
    setError('')
    setLoading(true)
    setCurrentPage(nextPage)
  }

  function changePageSize(nextPageSize: number) {
    if (!PAGE_SIZE_OPTIONS.includes(nextPageSize) || nextPageSize === pageSize) return
    setError('')
    setLoading(true)
    setCurrentPage(1)
    setPageSize(nextPageSize)
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
    setListReloadKey((value) => value + 1)
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
          label="người dùng"
          summaryLabel="người dùng"
          showPageSize={placement === 'bottom'}
          disabled={loading}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.metrics} aria-label="Thống kê người dùng" aria-busy={statsLoading}>
        <MetricCard label="Tổng người dùng" value={stats?.total} loading={statsLoading} tone="teal" icon={Users} />
        <MetricCard label="Đang hoạt động" value={stats?.active} loading={statsLoading} tone="green" icon={UserCheck} />
        <MetricCard label="Đã vô hiệu hóa" value={stats?.inactive} loading={statsLoading} tone="amber" icon={UserX} />
        <MetricCard label="Quản trị viên" value={stats?.admins} loading={statsLoading} tone="violet" icon={ShieldCheck} />
      </section>

      {statsError && (
        <div className={styles.statsError} role="alert">
          <span>{statsError}</span>
          <button type="button" onClick={retryStats} disabled={statsLoading}>Thử tải lại</button>
        </div>
      )}

      <section className={`${adminStyles.panel} ${styles.userPanel}`} aria-label="Danh sách người dùng" aria-busy={loading}>
        <div className={`${adminStyles.toolbar} ${styles.toolbar}`}>
          <label className={`${adminStyles.searchField} ${styles.searchField}`}>
            <AdminIcon name="search" size={18} />
            <span className={styles.srOnly}>Tìm theo tên đăng nhập, email hoặc họ tên</span>
            <input aria-label="Tìm theo tên đăng nhập, email hoặc họ tên" placeholder="Tìm theo tên đăng nhập, email hoặc họ tên…" value={searchInput} maxLength={100} onChange={(event) => setSearchInput(event.target.value)} />
          </label>
          <select aria-label="Lọc theo vai trò" value={role} onChange={(event) => changeFilter(() => setRole(event.target.value as AdminUserRole | 'all'))}>
            <option value="all">Tất cả vai trò</option>
            <option value="STUDENT">Học viên</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
          <select aria-label="Lọc theo trạng thái tài khoản" value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value as AdminUserStatus | 'all'))}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </select>
          <button className={adminStyles.buttonQuiet} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>

        {renderPagination('top')}
        {error && (
          <div className={styles.listError} role="alert">
            <span>{error}</span>
            <button type="button" onClick={retryList} disabled={loading}>Thử lại</button>
          </div>
        )}
        {loading ? <p className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</p>
          : users.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>{error ? 'Không thể tải danh sách' : filtered ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}</h2>
              {filtered && <><p>Thử từ khóa khác hoặc xóa bộ lọc.</p><button className={adminStyles.buttonSecondary} type="button" onClick={clearFilters}>Xóa bộ lọc</button></>}
            </div>
          ) : (
            <div className={`${adminStyles.tableWrap} ${styles.tableWrap}`} role="region" aria-label="Bảng người dùng" tabIndex={0}>
              <table className={styles.userTable}>
                <thead><tr><th scope="col">TÊN ĐĂNG NHẬP</th><th scope="col">EMAIL</th><th scope="col">HỌ VÀ TÊN</th><th scope="col">VAI TRÒ</th><th scope="col">TRẠNG THÁI</th><th scope="col">NGÀY ĐĂNG KÝ</th><th scope="col">THAO TÁC</th></tr></thead>
                <tbody>{users.map((user) => {
                  const isSelf = user.id === currentUser?.id
                  const selfHint = 'Bạn không thể thay đổi quyền hoặc trạng thái của chính mình.'
                  return (
                    <tr key={user.id}>
                      <td data-label="Tên đăng nhập"><span className={styles.userName}>{user.username || '—'}</span>{isSelf && <span className={styles.selfBadge}>Bạn</span>}</td>
                      <td data-label="Email" className={styles.userEmail}>{user.email}</td>
                      <td data-label="Họ và tên">{user.fullName || '—'}</td>
                      <td data-label="Vai trò"><span className={`${adminStyles.badge} ${adminStyles[user.role === 'ADMIN' ? 'role_admin' : 'role_student']}`}>{roleLabels[user.role]}</span></td>
                      <td data-label="Trạng thái"><span className={`${adminStyles.badge} ${adminStyles[user.isActive ? 'status_published' : 'status_inactive']}`}>{user.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></td>
                      <td data-label="Ngày đăng ký">{formatDate(user.createdAt)}</td>
                      <td data-label="Thao tác">
                        <div className={styles.rowActions}>
                          <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" aria-label={`Xem chi tiết ${displayName(user)}`} onClick={() => setDetailUser(user)}><Eye size={14} aria-hidden="true" /> Chi tiết</button>
                          {user.role === 'STUDENT'
                            ? <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" onClick={() => openAction(user, 'promote')}><ShieldCheck size={14} aria-hidden="true" /> Cấp Admin</button>
                            : <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" disabled={isSelf} title={isSelf ? selfHint : undefined} onClick={() => openAction(user, 'demote')}><Shield size={14} aria-hidden="true" /> Gỡ Admin</button>}
                          {user.isActive
                            ? <button className={`${adminStyles.iconButton} ${adminStyles.iconButtonDanger} ${styles.actionButton}`} type="button" disabled={isSelf} title={isSelf ? selfHint : undefined} onClick={() => openAction(user, 'deactivate')}><UserX size={14} aria-hidden="true" /> Vô hiệu hóa</button>
                            : <button className={`${adminStyles.iconButton} ${styles.actionButton}`} type="button" onClick={() => openAction(user, 'activate')}><CircleCheck size={14} aria-hidden="true" /> Kích hoạt</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        {renderPagination('bottom')}
      </section>
      {pending && (
        <ConfirmDialog
          title={actionCopy[pending.action].title}
          description={actionCopy[pending.action].describe(displayName(pending.user))}
          confirmLabel={actionCopy[pending.action].confirm}
          danger={actionCopy[pending.action].danger}
          busy={saving}
          error={actionError}
          onConfirm={() => void completeAction()}
          onCancel={() => !saving && setPending(null)}
        />
      )}
      {detailUser && <UserDetailDialog user={detailUser} onClose={() => setDetailUser(null)} />}
    </div>
  )
}

function MetricCard({ label, value, loading, tone, icon: Icon }: MetricCardProps) {
  const formattedValue = value === undefined ? undefined : new Intl.NumberFormat('vi-VN').format(value)
  return (
    <article className={styles.metricCard}>
      <span className={`${styles.metricIcon} ${styles[tone]}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <p>{label}</p>
      {loading ? <span className={styles.metricSkeleton} aria-label="Đang tải" /> : <strong>{formattedValue ?? '—'}</strong>}
    </article>
  )
}

export default AdminUsersPage
