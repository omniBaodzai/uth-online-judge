import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Notice } from '../components'
import styles from '../admin.module.css'

type Status = {
  generatedAt: string
  database: { ok: boolean; latencyMs?: number; sizeBytes?: number; connections?: number; version?: string; error?: string }
  redis: { ok: boolean; latencyMs?: number; queue?: Record<string, number>; error?: string }
  judge0: { ok: boolean; latencyMs?: number; error?: string }
  process: { uptimeSeconds: number; rssMb: number; heapUsedMb: number; nodeVersion: string; loadAverage: number[] }
  counts: Record<string, number>
  traffic: { day: string; logins: number; submissions: number; registrations: number }[]
}
type Activity = { id: string; action: string; username: string | null; actorUsername: string | null; ip: string | null; createdAt: string }

const countLabels: [string, string][] = [
  ['users', 'Người dùng'], ['lockedUsers', 'Tài khoản bị khóa'], ['problems', 'Bài tập'], ['submissions', 'Bài nộp'],
  ['pendingSubmissions', 'Đang chờ chấm'], ['pendingContributions', 'Chờ kiểm duyệt'], ['openTickets', 'Yêu cầu hỗ trợ mở'], ['errors24h', 'Lỗi 24 giờ qua'],
]

function Health({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <div className={styles.stat}>
      <span>{name}</span>
      <strong><Badge tone={ok ? 'green' : 'red'}>{ok ? 'Hoạt động' : 'Lỗi'}</Badge></strong>
      <small>{detail}</small>
    </div>
  )
}

function Dashboard() {
  const status = useAdminQuery<Status>('/api/admin/system/status')
  const activity = useAdminQuery<Paged<Activity>>('/api/admin/system/activity?pageSize=10')
  const s = status.data
  const peak = Math.max(1, ...(s?.traffic.map((day) => day.submissions + day.logins) ?? [1]))
  return (
    <>
      <Notice kind="error">{status.error}</Notice>
      {s && (
        <>
          <div className={styles.grid}>
            <Health name="PostgreSQL" ok={s.database.ok} detail={s.database.ok ? `${s.database.latencyMs} ms · ${s.database.connections} kết nối · ${((s.database.sizeBytes ?? 0) / 1048576).toFixed(1)} MB` : (s.database.error ?? '')} />
            <Health name="Redis / hàng đợi" ok={s.redis.ok} detail={s.redis.ok ? `${s.redis.latencyMs} ms · chờ ${s.redis.queue?.waiting ?? 0} · lỗi ${s.redis.queue?.failed ?? 0}` : (s.redis.error ?? '')} />
            <Health name="Judge0" ok={s.judge0.ok} detail={s.judge0.ok ? `${s.judge0.latencyMs} ms` : (s.judge0.error ?? '')} />
            <Health name="Máy chủ API" ok detail={`Chạy ${Math.floor(s.process.uptimeSeconds / 60)} phút · RAM ${s.process.rssMb} MB · ${s.process.nodeVersion}`} />
          </div>
          <div className={styles.grid}>
            {countLabels.map(([key, label]) => (
              <div key={key} className={styles.stat}><span>{label}</span><strong>{s.counts[key] ?? 0}</strong></div>
            ))}
          </div>
          <section className={styles.card}>
            <h3>Lượt truy cập & hoạt động 14 ngày gần nhất</h3>
            <div className={styles.bars}>
              {s.traffic.map((day) => (
                <div key={day.day} className={styles.barCol} title={`${day.day}: ${day.logins} đăng nhập, ${day.submissions} bài nộp, ${day.registrations} đăng ký`}>
                  <span>{day.logins + day.submissions}</span>
                  <div className={styles.bar} style={{ height: `${((day.logins + day.submissions) / peak) * 80}%` }} />
                  <span>{day.day.slice(8)}</span>
                </div>
              ))}
            </div>
            <p className={styles.muted}>Cột = số lượt đăng nhập + bài nộp mỗi ngày. Cập nhật {formatDate(s.generatedAt)}.</p>
          </section>
        </>
      )}
      <section className={styles.card}>
        <h3>Hoạt động gần đây</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thời gian</th><th>Hành động</th><th>Người dùng</th><th>Thực hiện bởi</th><th>IP</th></tr></thead>
            <tbody>
              {activity.data?.items.map((row) => (
                <tr key={row.id}><td>{formatDate(row.createdAt)}</td><td>{row.action}</td><td>{row.username ?? '—'}</td><td>{row.actorUsername ?? '—'}</td><td>{row.ip ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ModeratorHome() {
  return (
    <section className={styles.card}>
      <h3>Công việc của điều hành viên</h3>
      <div className={styles.actions}>
        <Link className={styles.btn} to="/admin/moderation">Kiểm duyệt nội dung</Link>
        <Link className={styles.btn} to="/admin/support">Yêu cầu hỗ trợ</Link>
      </div>
    </section>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  return (
    <AdminLayout title="Tổng quan hệ thống" subtitle="Tình trạng dịch vụ, số liệu và hoạt động gần đây." adminOnly={false}>
      {user?.role === 'ADMIN' ? <Dashboard /> : <ModeratorHome />}
    </AdminLayout>
  )
}
