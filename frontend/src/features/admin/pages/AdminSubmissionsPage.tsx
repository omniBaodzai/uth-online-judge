import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type Row = { id: string; username: string; problemCode: string; languageId: number; status: string; score: number; passedTests: number; totalTests: number; executionTime: number | null; memoryUsed: number | null; createdAt: string }
const statuses = ['PENDING', 'JUDGING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE']

export default function AdminSubmissionsPage() {
  const { request } = useAuth()
  const [status, setStatus] = useState('')
  const [problemCode, setProblemCode] = useState('')
  const [username, setUsername] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const list = useAdminQuery<Paged<Row>>(`/api/admin/submissions${buildQuery({ status, problemCode: problemCode.trim(), username: username.trim(), page, pageSize: 20 })}`)

  async function act(row: Row, kind: 'rejudge' | 'delete') {
    if (kind === 'delete' && !window.confirm('Xóa bài nộp này?')) return
    setError('')
    try {
      await request(kind === 'rejudge' ? `/api/admin/submissions/${row.id}/rejudge` : `/api/admin/submissions/${row.id}`, { method: kind === 'rejudge' ? 'POST' : 'DELETE' })
      setMessage(kind === 'rejudge' ? 'Đã đưa bài nộp vào hàng đợi chấm lại.' : 'Đã xóa bài nộp.')
      list.reload()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  return (
    <AdminLayout title="Quản lý bài nộp" subtitle="Lọc, chấm lại hoặc xóa bài nộp của người dùng.">
      <Notice kind="error">{error || list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      <div className={styles.toolbar}>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          {statuses.map((value) => <option key={value}>{value}</option>)}
        </select>
        <input placeholder="Mã bài" value={problemCode} onChange={(event) => { setProblemCode(event.target.value); setPage(1) }} />
        <input placeholder="Tên đăng nhập" value={username} onChange={(event) => { setUsername(event.target.value); setPage(1) }} />
      </div>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thời gian</th><th>Người nộp</th><th>Bài</th><th>Trạng thái</th><th>Điểm</th><th>Test</th><th>Thời gian / Bộ nhớ</th><th>Thao tác</th></tr></thead>
            <tbody>
              {list.data?.items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td><td>{row.username}</td><td>{row.problemCode}</td>
                  <td><Badge tone={row.status === 'AC' ? 'green' : row.status === 'PENDING' || row.status === 'JUDGING' ? 'amber' : 'red'}>{row.status}</Badge></td>
                  <td>{row.score}</td><td>{row.passedTests}/{row.totalTests}</td><td>{row.executionTime ?? '—'}s / {row.memoryUsed ?? '—'}KB</td>
                  <td><div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => void act(row, 'rejudge')}>Chấm lại</button>
                    <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => void act(row, 'delete')}>Xóa</button>
                  </div></td>
                </tr>
              ))}
              {list.data?.items.length === 0 && <tr><td colSpan={8}>Không có bài nộp.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
    </AdminLayout>
  )
}
