import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type Log = { id: string; source: 'BACKEND' | 'FRONTEND'; level: 'ERROR' | 'WARN'; message: string; stack: string | null; path: string | null; method: string | null; statusCode: number | null; createdAt: string }

export default function AdminLogsPage() {
  const { request } = useAuth()
  const [source, setSource] = useState('')
  const [level, setLevel] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const list = useAdminQuery<Paged<Log>>(`/api/admin/system/error-logs${buildQuery({ source, level, search: query, page, pageSize: 20 })}`)

  async function clear() {
    const days = window.prompt('Xóa nhật ký cũ hơn bao nhiêu ngày? (0 = xóa toàn bộ)', '30')
    if (days === null) return
    try {
      const result = await request<{ deleted: number }>(`/api/admin/system/error-logs?olderThanDays=${encodeURIComponent(days)}`, { method: 'DELETE' })
      setMessage(`Đã xóa ${result.deleted} bản ghi.`)
      list.reload()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  return (
    <AdminLayout title="Nhật ký lỗi hệ thống" subtitle="Lỗi từ máy chủ (5xx) và giao diện người dùng để gỡ lỗi.">
      <Notice kind="error">{error || list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}>
        <input type="search" placeholder="Tìm trong nội dung lỗi…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1) }} aria-label="Nguồn">
          <option value="">Mọi nguồn</option><option value="BACKEND">Backend</option><option value="FRONTEND">Frontend</option>
        </select>
        <select value={level} onChange={(event) => { setLevel(event.target.value); setPage(1) }} aria-label="Mức độ">
          <option value="">Mọi mức</option><option value="ERROR">ERROR</option><option value="WARN">WARN</option>
        </select>
        <button type="submit" className={styles.btn}>Tìm</button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => void clear()}>Dọn nhật ký</button>
      </form>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thời gian</th><th>Nguồn</th><th>Mức</th><th>Thông báo</th><th>Vị trí</th></tr></thead>
            <tbody>
              {list.data?.items.map((row) => (
                <tr key={row.id} onClick={() => setOpenId(openId === row.id ? '' : row.id)} style={{ cursor: 'pointer' }}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td><Badge tone={row.source === 'BACKEND' ? 'blue' : 'amber'}>{row.source}</Badge></td>
                  <td><Badge tone={row.level === 'ERROR' ? 'red' : 'amber'}>{row.level}</Badge></td>
                  <td className={styles.wrap}>{row.message}{openId === row.id && row.stack && <pre className={`${styles.stack} ${styles.mono}`}>{row.stack}</pre>}</td>
                  <td className={styles.mono}>{row.method} {row.path}{row.statusCode ? ` → ${row.statusCode}` : ''}</td>
                </tr>
              ))}
              {list.data?.items.length === 0 && <tr><td colSpan={5}>Không có lỗi nào được ghi nhận.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
    </AdminLayout>
  )
}
