import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type Row = { id: string; username: string; kind: string; problemCode: string | null; title: string | null; body: string; status: 'PENDING' | 'APPROVED' | 'HIDDEN'; moderationNote: string | null; createdAt: string }
const tone = { PENDING: 'amber', APPROVED: 'green', HIDDEN: 'gray' } as const
const label = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', HIDDEN: 'Đã ẩn' } as const

export default function AdminModerationPage() {
  const { request, user } = useAuth()
  const [status, setStatus] = useState('PENDING')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const list = useAdminQuery<Paged<Row>>(`/api/admin/contributions${buildQuery({ status, kind, page, pageSize: 15 })}`)

  async function act(task: () => Promise<unknown>, success: string) {
    setError('')
    try {
      await task()
      setMessage(success)
      list.reload()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  function moderate(row: Row, next: Row['status']) {
    const note = next === 'HIDDEN' ? window.prompt('Lý do ẩn (không bắt buộc):') : null
    if (next === 'HIDDEN' && note === null) return
    void act(() => request(`/api/admin/contributions/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: next, note: note || undefined }) }), next === 'APPROVED' ? 'Đã phê duyệt.' : 'Đã ẩn nội dung.')
  }

  return (
    <AdminLayout title="Kiểm duyệt nội dung" subtitle="Phê duyệt, ẩn hoặc xóa bình luận, blog và lời giải do người dùng đóng góp." adminOnly={false}>
      <Notice kind="error">{error || list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      <div className={styles.toolbar}>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          <option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="HIDDEN">Đã ẩn</option>
        </select>
        <select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1) }} aria-label="Lọc loại">
          <option value="">Mọi loại</option>
          <option value="COMMENT">Bình luận</option><option value="BLOG">Blog</option><option value="SOLUTION">Lời giải</option>
        </select>
      </div>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thời gian</th><th>Người đăng</th><th>Loại</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {list.data?.items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td><td>{row.username}</td><td>{row.kind}{row.problemCode ? ` · ${row.problemCode}` : ''}</td>
                  <td className={styles.wrap}>{row.title && <b>{row.title}<br /></b>}{row.body}{row.moderationNote && <><br /><span className={styles.muted}>Ghi chú: {row.moderationNote}</span></>}</td>
                  <td><Badge tone={tone[row.status]}>{label[row.status]}</Badge></td>
                  <td><div className={styles.actions}>
                    {row.status !== 'APPROVED' && <button type="button" className={styles.btn} onClick={() => moderate(row, 'APPROVED')}>Duyệt</button>}
                    {row.status !== 'HIDDEN' && <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => moderate(row, 'HIDDEN')}>Ẩn</button>}
                    {user?.role === 'ADMIN' && <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => { if (window.confirm('Xóa vĩnh viễn nội dung này?')) void act(() => request(`/api/admin/contributions/${row.id}`, { method: 'DELETE' }), 'Đã xóa nội dung.') }}>Xóa</button>}
                  </div></td>
                </tr>
              ))}
              {list.data?.items.length === 0 && <tr><td colSpan={6}>Không có nội dung cần xử lý.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
    </AdminLayout>
  )
}
