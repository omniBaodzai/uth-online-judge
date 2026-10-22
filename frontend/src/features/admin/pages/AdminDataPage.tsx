import { useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { describeError, formatDate, useAdminQuery } from '../api'
import { Notice } from '../components'
import styles from '../admin.module.css'

type Backup = { name: string; sizeBytes: number; createdAt: string }
const exportTables = [
  ['users', 'Người dùng (không gồm mật khẩu)'], ['problems', 'Bài tập'], ['test_cases', 'Test case'], ['submissions', 'Bài nộp'],
]

export default function AdminDataPage() {
  const { request } = useAuth()
  const backups = useAdminQuery<Backup[]>('/api/admin/data/backups')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [importTable, setImportTable] = useState<'problems' | 'test_cases'>('problems')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [restoreTarget, setRestoreTarget] = useState('')
  const [confirmText, setConfirmText] = useState('')

  async function run(task: () => Promise<string | void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await task()
      if (result) setMessage(result)
    } catch (reason) {
      setError(describeError(reason))
    } finally {
      setBusy(false)
    }
  }

  const download = (table: string) =>
    run(async () => {
      const csv = await request<string>(`/api/admin/data/export/${table}`)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${table}-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      return `Đã xuất ${table}.`
    })

  const upload = (file: File | undefined) =>
    file &&
    run(async () => {
      const csv = await file.text()
      const result = await request<{ imported: number; errors: string[] }>('/api/admin/data/import', { method: 'POST', body: JSON.stringify({ table: importTable, csv }) })
      setImportErrors(result.errors)
      return `Đã nhập ${result.imported} dòng${result.errors.length ? `, ${result.errors.length} dòng bị bỏ qua` : ''}.`
    })

  return (
    <AdminLayout title="Dữ liệu & sao lưu" subtitle="Xuất/nhập CSV (mở được bằng Excel) và sao lưu/phục hồi cơ sở dữ liệu.">
      <Notice kind="error">{error}</Notice>
      <Notice kind="success">{message}</Notice>

      <section className={styles.card}>
        <h3>Xuất dữ liệu CSV</h3>
        <div className={styles.actions}>
          {exportTables.map(([table, label]) => (
            <button key={table} type="button" className={`${styles.btn} ${styles.ghost}`} disabled={busy} onClick={() => void download(table)}><Download size={15} aria-hidden="true" />{label}</button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h3>Nhập dữ liệu CSV</h3>
        <p className={styles.muted}>
          {importTable === 'problems'
            ? 'Cột: code, title, time_limit_seconds, memory_limit_mb, total_score. Bài đã có (theo code) sẽ được cập nhật.'
            : 'Cột: problem_code, input, expected_output, is_sample. Test case hiện có của mỗi bài trong tệp sẽ bị thay thế.'}
        </p>
        <div className={styles.toolbar}>
          <select value={importTable} onChange={(event) => setImportTable(event.target.value as 'problems' | 'test_cases')} aria-label="Bảng nhập">
            <option value="problems">Bài tập</option><option value="test_cases">Test case</option>
          </select>
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
        </div>
        {importErrors.length > 0 && <ul className={styles.error}>{importErrors.map((line) => <li key={line}>{line}</li>)}</ul>}
      </section>

      <section className={styles.card}>
        <h3>Sao lưu & phục hồi</h3>
        <p className={styles.muted}>Tệp sao lưu (JSON) lưu trên máy chủ và chứa mã băm mật khẩu — hãy bảo vệ thư mục sao lưu. Trước mỗi lần phục hồi hệ thống tự tạo một bản sao lưu an toàn.</p>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btn} disabled={busy} onClick={() => void run(async () => { const result = await request<{ name: string }>('/api/admin/data/backups', { method: 'POST' }); backups.reload(); return `Đã tạo ${result.name}.` })}>+ Tạo bản sao lưu</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Tệp</th><th>Thời gian</th><th>Dung lượng</th><th>Thao tác</th></tr></thead>
            <tbody>
              {backups.data?.map((backup) => (
                <tr key={backup.name}>
                  <td className={styles.mono}>{backup.name}</td><td>{formatDate(backup.createdAt)}</td><td>{(backup.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td><div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => { setRestoreTarget(backup.name); setConfirmText('') }}>Phục hồi</button>
                    <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={busy} onClick={() => { if (window.confirm(`Xóa ${backup.name}?`)) void run(async () => { await request(`/api/admin/data/backups/${backup.name}`, { method: 'DELETE' }); backups.reload(); return 'Đã xóa bản sao lưu.' }) }}>Xóa</button>
                  </div></td>
                </tr>
              ))}
              {backups.data?.length === 0 && <tr><td colSpan={4}>Chưa có bản sao lưu.</td></tr>}
            </tbody>
          </table>
        </div>
        {restoreTarget && (
          <div className={styles.secret} style={{ marginTop: 12 }}>
            <b>Phục hồi {restoreTarget}</b> sẽ ghi đè toàn bộ dữ liệu hiện tại và đăng xuất mọi người dùng. Nhập <code>RESTORE</code> để xác nhận.
            <div className={styles.toolbar} style={{ marginTop: 8 }}>
              <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="RESTORE" aria-label="Xác nhận phục hồi" />
              <button type="button" className={`${styles.btn} ${styles.danger}`} disabled={busy || confirmText !== 'RESTORE'}
                onClick={() => void run(async () => { const result = await request<{ safetyBackup: string }>(`/api/admin/data/backups/${restoreTarget}/restore`, { method: 'POST', body: JSON.stringify({ confirm: 'RESTORE' }) }); setRestoreTarget(''); backups.reload(); return `Đã phục hồi. Bản an toàn trước đó: ${result.safetyBackup}.` })}>
                Xác nhận phục hồi
              </button>
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setRestoreTarget('')}>Hủy</button>
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
