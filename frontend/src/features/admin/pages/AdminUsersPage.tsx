import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { UserDetailDialog } from '../components/UserDetailDialog'
import { formatDate, roleLabels } from '../utils'
import type { AdminUser, AdminUserPage, AdminUserRole, AdminUserStatus } from '../types'
import styles from '../admin.module.css'

type UserAction = 'promote' | 'demote' | 'activate' | 'deactivate'
type PendingAction = { user: AdminUser; action: UserAction }

const PAGE_SIZE = 20

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

function AdminUsersPage() {
  const { request, setNotice } = useAdmin()
  const { user: currentUser } = useAuth()
  const [page, setPage] = useState<AdminUserPage | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<AdminUserRole | 'all'>('all')
  const [status, setStatus] = useState<AdminUserStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)

  const fetchPage = useCallback(() => {
    const query = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) })
    if (search) query.set('search', search)
    if (role !== 'all') query.set('role', role)
    if (status !== 'all') query.set('status', status)
    return request<AdminUserPage>(`/admin/users?${query.toString()}`)
  }, [currentPage, request, role, search, status])

  const load = useCallback(async () => {
    try {
      setPage(await fetchPage())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    let active = true
    fetchPage().then((data) => {
      if (active) setPage(data)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách người dùng.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fetchPage])

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
      await load()
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Không thể cập nhật người dùng. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const users = page?.items ?? []
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / PAGE_SIZE))
  const filtered = Boolean(search || role !== 'all' || status !== 'all')

  return (
    <>
      <div className={styles.pageHeading}>
        <div><h1>Quản lý người dùng</h1></div>
      </div>
      <section className={styles.panel} aria-label="Danh sách người dùng" aria-busy={loading}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <AdminIcon name="search" size={18} />
            <input aria-label="Tìm theo tên đăng nhập hoặc email" placeholder="Tìm theo tên đăng nhập, email hoặc họ tên…" value={searchInput} maxLength={100} onChange={(event) => setSearchInput(event.target.value)} />
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
          <button className={styles.buttonQuiet} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
        {error && <p className={styles.formMessage} role="alert">{error} <button className={styles.textLink} type="button" onClick={() => { setLoading(true); setError(''); void load() }}>Thử lại</button></p>}
        <p className={styles.fieldHint} aria-live="polite">Hiển thị {users.length} / {page?.total ?? 0} người dùng</p>
        {loading ? <p className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</p>
          : users.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>{error ? 'Không thể tải danh sách' : filtered ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}</h2>
              {filtered && <><p>Thử từ khóa khác hoặc xóa bộ lọc.</p><button className={styles.buttonSecondary} type="button" onClick={clearFilters}>Xóa bộ lọc</button></>}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.userTable}>
                <thead><tr><th scope="col">Tên đăng nhập</th><th scope="col">Email</th><th scope="col">Họ và tên</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày đăng ký</th><th scope="col">Thao tác</th></tr></thead>
                <tbody>{users.map((user) => {
                  const isSelf = user.id === currentUser?.id
                  const selfHint = 'Bạn không thể thay đổi quyền hoặc trạng thái của chính mình.'
                  return (
                    <tr key={user.id}>
                      <td data-label="Tên đăng nhập"><span className={styles.userName}>{user.username || '—'}</span>{isSelf && <span className={styles.selfBadge}>Bạn</span>}</td>
                      <td data-label="Email" className={styles.userEmail}>{user.email}</td>
                      <td data-label="Họ và tên">{user.fullName || '—'}</td>
                      <td data-label="Vai trò"><span className={`${styles.badge} ${user.role === 'ADMIN' ? styles.role_admin : styles.role_student}`}>{roleLabels[user.role]}</span></td>
                      <td data-label="Trạng thái"><span className={`${styles.badge} ${user.isActive ? styles.status_published : styles.status_inactive}`}>{user.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></td>
                      <td data-label="Ngày đăng ký">{formatDate(user.createdAt)}</td>
                      <td data-label="Thao tác">
                        <div className={styles.rowActions}>
                          <button className={styles.iconButton} type="button" aria-label={`Xem chi tiết ${displayName(user)}`} onClick={() => setDetailUser(user)}><AdminIcon name="eye" size={14} /> Chi tiết</button>
                          {user.role === 'STUDENT'
                            ? <button className={styles.iconButton} type="button" onClick={() => openAction(user, 'promote')}>Cấp Admin</button>
                            : <button className={styles.iconButton} type="button" disabled={isSelf} title={isSelf ? selfHint : undefined} onClick={() => openAction(user, 'demote')}>Gỡ Admin</button>}
                          {user.isActive
                            ? <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} type="button" disabled={isSelf} title={isSelf ? selfHint : undefined} onClick={() => openAction(user, 'deactivate')}>Vô hiệu hóa</button>
                            : <button className={styles.iconButton} type="button" onClick={() => openAction(user, 'activate')}>Kích hoạt</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        <div className={styles.rowActions}>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage <= 1 || loading} onClick={() => { setLoading(true); setCurrentPage((value) => value - 1) }}>Trang trước</button>
          <span aria-live="polite">Trang {currentPage} / {totalPages}</span>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage >= totalPages || loading} onClick={() => { setLoading(true); setCurrentPage((value) => value + 1) }}>Trang sau</button>
        </div>
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
    </>
  )
}

export default AdminUsersPage
