import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Modal, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type Role = 'ADMIN' | 'MODERATOR' | 'USER'
type UserRow = { id: string; username: string | null; email: string; fullName: string | null; role: Role; isActive: boolean; createdAt: string; submissionCount: number; lastLoginAt: string | null }
type Activity = { id: string; action: string; detail: unknown; ip: string | null; actorUsername: string | null; createdAt: string }

const roleLabel: Record<Role, string> = { ADMIN: 'Quản trị viên', MODERATOR: 'Điều hành viên', USER: 'Người dùng' }
const roleTone = { ADMIN: 'red', MODERATOR: 'blue', USER: 'gray' } as const

function ActivityModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const { data, error } = useAdminQuery<Paged<Activity>>(`/api/admin/users/${user.id}/activity${buildQuery({ page, pageSize: 15 })}`)
  return (
    <Modal title={`Lịch sử hoạt động — ${user.username ?? user.email}`} onClose={onClose} wide>
      <Notice kind="error">{error}</Notice>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Thời gian</th><th>Hành động</th><th>Chi tiết</th><th>IP</th><th>Bởi</th></tr></thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td><td>{row.action}</td>
                <td className={`${styles.wrap} ${styles.mono}`}>{row.detail ? JSON.stringify(row.detail) : '—'}</td>
                <td>{row.ip ?? '—'}</td><td>{row.actorUsername ?? '—'}</td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={5}>Chưa có hoạt động.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </Modal>
  )
}

export default function AdminUsersPage() {
  const { request, user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null)
  const [viewing, setViewing] = useState<UserRow | null>(null)
  const list = useAdminQuery<Paged<UserRow>>(`/api/admin/users${buildQuery({ search: query, role, status, page, pageSize: 15 })}`)

  async function act(task: () => Promise<unknown>, success: string) {
    setError('')
    setMessage('')
    try {
      await task()
      setMessage(success)
      list.reload()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

  return (
    <AdminLayout title="Quản lý người dùng" subtitle="Tìm kiếm, phân quyền, khóa/mở khóa, đặt lại mật khẩu và xem lịch sử hoạt động.">
      <Notice kind="error">{error || list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      {secret && (
        <div className={styles.secret}>
          Mật khẩu tạm thời của <b>{secret.username}</b>: <code>{secret.password}</code>
          <br /><span className={styles.muted}>Chỉ hiển thị một lần — hãy gửi cho người dùng và yêu cầu đổi ngay.</span>{' '}
          <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setSecret(null)}>Đã lưu</button>
        </div>
      )}
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}>
        <input type="search" placeholder="Tìm theo tên đăng nhập, email, họ tên…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }} aria-label="Lọc vai trò">
          <option value="">Mọi vai trò</option>
          {(Object.keys(roleLabel) as Role[]).map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
        </select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>
        <button className={styles.btn} type="submit">Tìm</button>
      </form>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Bài nộp</th><th>Đăng nhập gần nhất</th><th>Thao tác</th></tr></thead>
            <tbody>
              {list.data?.items.map((row) => {
                const isSelf = row.id === me?.id
                return (
                  <tr key={row.id}>
                    <td><b>{row.username ?? '—'}</b><br /><span className={styles.muted}>{row.email}</span></td>
                    <td>
                      <select
                        value={row.role}
                        disabled={isSelf}
                        aria-label={`Vai trò của ${row.username}`}
                        onChange={(event) => void act(() => request(`/api/admin/users/${row.id}/role`, json('PATCH', { role: event.target.value })), `Đã đổi vai trò của ${row.username}.`)}
                      >
                        {(Object.keys(roleLabel) as Role[]).map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
                      </select>
                      <br /><Badge tone={roleTone[row.role]}>{row.role}</Badge>
                    </td>
                    <td><Badge tone={row.isActive ? 'green' : 'red'}>{row.isActive ? 'Hoạt động' : 'Đã khóa'}</Badge></td>
                    <td>{row.submissionCount}</td>
                    <td>{formatDate(row.lastLoginAt)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" className={`${styles.btn} ${row.isActive ? styles.danger : ''}`} disabled={isSelf}
                          onClick={() => { if (!row.isActive || window.confirm(`Khóa tài khoản ${row.username}? Mọi phiên đăng nhập sẽ bị thu hồi.`)) void act(() => request(`/api/admin/users/${row.id}/status`, json('PATCH', { isActive: !row.isActive })), row.isActive ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.') }}>
                          {row.isActive ? 'Khóa' : 'Mở khóa'}
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.ghost}`}
                          onClick={() => { if (window.confirm(`Đặt lại mật khẩu của ${row.username}?`)) void act(async () => { const result = await request<{ temporaryPassword: string }>(`/api/admin/users/${row.id}/reset-password`, json('POST')); setSecret({ username: row.username ?? row.email, password: result.temporaryPassword }) }, 'Đã đặt lại mật khẩu.') }}>
                          Đặt lại MK
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setViewing(row)}>Nhật ký</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {list.data?.items.length === 0 && <tr><td colSpan={6}>Không có người dùng phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
      {viewing && <ActivityModal user={viewing} onClose={() => setViewing(null)} />}
    </AdminLayout>
  )
}
