import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { AdminIcon } from '../components/AdminIcons'
import { formatDate, statusLabels } from '../utils'
import { useAdmin } from '../useAdmin'
import type { AdminDashboard } from '../types'
import styles from '../admin.module.css'

function AdminDashboardPage() {
  const { request } = useAdmin()
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(
    () => request<AdminDashboard>('/admin/dashboard'),
    [request],
  )
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await fetchDashboard())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải tổng quan Admin.')
    } finally {
      setLoading(false)
    }
  }, [fetchDashboard])

  useEffect(() => {
    let active = true
    fetchDashboard().then((data) => {
      if (active) setDashboard(data)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải tổng quan Admin.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fetchDashboard])

  return (
    <>
      <div className={styles.pageHeading}>
        <h1>Tổng quan</h1>
        <Link className={styles.buttonPrimary} to="/admin/problems/new"><AdminIcon name="plus" /> Tạo bài tập</Link>
      </div>
      {error && <div className={styles.formMessage} role="alert">{error} <button className={styles.textLink} type="button" onClick={() => void load()}>Thử lại</button></div>}
      <div className={styles.metricGrid} aria-busy={loading}>
        <Metric label="Tổng bài tập" value={dashboard?.total ?? 0} tone="teal" />
        <Metric label="Đã xuất bản" value={dashboard?.published ?? 0} tone="green" />
        <Metric label="Bản nháp" value={dashboard?.draft ?? 0} tone="amber" />
        <Metric label="Đã lưu trữ" value={dashboard?.archived ?? 0} tone="slate" />
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <h2>Bài tập cập nhật gần đây</h2>
          <Link className={styles.textLink} to="/admin/problems">Xem tất cả <AdminIcon name="chevron" size={15} /></Link>
        </div>
        {loading ? <p className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</p>
          : dashboard?.recent.length === 0 ? <p className={styles.emptyState}>Chưa có bài tập.</p> : (
            <div className={styles.recentList}>
              {dashboard?.recent.map((problem) => (
                <Link className={styles.recentRow} to={`/admin/problems/${problem.id}/edit`} key={problem.id}>
                  <span className={styles.code}>{problem.code}</span>
                  <span className={styles.recentName}><strong>{problem.title}</strong><small>Cập nhật {formatDate(problem.updatedAt)}</small></span>
                  <span className={`${styles.badge} ${styles[`status_${problem.status}`]}`}>{statusLabels[problem.status]}</span>
                  <AdminIcon name="chevron" size={16} />
                </Link>
              ))}
            </div>
          )}
      </section>
    </>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className={styles.metricCard}><span className={`${styles.metricMark} ${styles[tone]}`} /><p>{label}</p><strong>{value.toString().padStart(2, '0')}</strong><small>Trong hệ thống</small></article>
}

export default AdminDashboardPage
