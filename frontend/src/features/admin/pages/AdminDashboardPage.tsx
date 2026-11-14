import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Code2,
  FileText,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import type { AdminDashboard, AdminUserPage } from '../types'
import type { ContestOverview } from '../contests/types'
import styles from './AdminDashboardPage.module.css'

type PublicStats = {
  submissions: number
}

type DashboardPeriod = 7 | 30 | 90
type SubmissionScope = 'GLOBAL' | 'ORGANIZATION'

type DashboardStatistics = {
  timezone: 'Asia/Ho_Chi_Minh'
  days: DashboardPeriod
  submissionScope: SubmissionScope
  submissions: {
    total: number
    daily: { date: string; count: number }[]
  }
  users: {
    total: number
    daily: { date: string; count: number }[]
  }
}

type DashboardData = {
  problems: AdminDashboard
  users: AdminUserPage
  contests: ContestOverview
  publicStats: PublicStats
}

type MetricCardProps = {
  label: string
  value: number
  detail: string
  icon: ReactNode
  tone: 'teal' | 'blue' | 'violet' | 'amber'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function getErrorMessage(cause: unknown, fallback = 'Không thể tải dữ liệu tổng quan. Vui lòng kiểm tra kết nối và thử lại.') {
  return cause instanceof ApiError
    ? cause.message
    : fallback
}

function AdminDashboardPage() {
  const { request } = useAdmin()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null)
  const [period, setPeriod] = useState<DashboardPeriod>(30)
  const [submissionScope, setSubmissionScope] = useState<SubmissionScope>('GLOBAL')
  const [statisticsRetry, setStatisticsRetry] = useState(0)
  const [statisticsError, setStatisticsError] = useState('')
  const [statisticsLoading, setStatisticsLoading] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    const [problems, users, contests, publicStats] = await Promise.all([
      request<AdminDashboard>('/admin/dashboard'),
      request<AdminUserPage>('/admin/users?page=1&pageSize=1'),
      request<ContestOverview>('/admin/contests/overview'),
      request<PublicStats>('/public/stats'),
    ])
    return { problems, users, contests, publicStats }
  }, [request])

  const retry = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await fetchDashboard())
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [fetchDashboard])

  useEffect(() => {
    let active = true
    fetchDashboard()
      .then((data) => {
        if (active) setDashboard(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchDashboard])

  useEffect(() => {
    let active = true
    request<DashboardStatistics>(
      `/admin/dashboard/statistics?days=${period}&submissionScope=${submissionScope}`,
    )
      .then((data) => {
        if (active) setStatistics(data)
      })
      .catch((cause: unknown) => {
        if (active) {
          setStatisticsError(
            getErrorMessage(cause, 'Không thể tải thống kê. Vui lòng thử lại sau.'),
          )
        }
      })
      .finally(() => {
        if (active) setStatisticsLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, request, statisticsRetry, submissionScope])

  return (
    <div className={styles.dashboard} aria-busy={loading}>
      {error && (
        <div className={styles.errorState} role="alert">
          <div>
            <strong>Chưa thể cập nhật tổng quan</strong>
            <p>{error}</p>
          </div>
          <button className={styles.retryButton} type="button" onClick={() => void retry()} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Thử tải lại
          </button>
        </div>
      )}

      <section className={styles.metricGrid} aria-label="Chỉ số tổng quan">
        {loading && !dashboard ? (
          Array.from({ length: 4 }, (_, index) => (
            <div className={styles.metricSkeleton} key={index} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ))
        ) : dashboard ? (
          <>
            <MetricCard
              label="Tài khoản"
              value={dashboard.users.total}
              detail="Tất cả tài khoản đã đăng ký"
              tone="teal"
              icon={<Users aria-hidden="true" />}
            />
            <MetricCard
              label="Bài nộp công khai"
              value={dashboard.publicStats.submissions}
              detail="Trên bài tập Global đã xuất bản"
              tone="blue"
              icon={<FileText aria-hidden="true" />}
            />
            <MetricCard
              label="Cuộc thi Global"
              value={dashboard.contests.total}
              detail="Toàn bộ trạng thái cuộc thi"
              tone="violet"
              icon={<Trophy aria-hidden="true" />}
            />
            <MetricCard
              label="Bài tập Global"
              value={dashboard.problems.total}
              detail="Bản nháp, đã xuất bản và lưu trữ"
              tone="amber"
              icon={<Code2 aria-hidden="true" />}
            />
          </>
        ) : (
          <p className={styles.inlineEmpty}>Số liệu sẽ xuất hiện khi kết nối được khôi phục.</p>
        )}
      </section>

      <section className={styles.analytics} aria-label="Thống kê hoạt động">
        <div className={styles.analyticsToolbar}>
          <div className={styles.periodLabel}>Khoảng thời gian</div>
          <div className={styles.periodOptions} role="group" aria-label="Khoảng thời gian thống kê">
            {([7, 30, 90] as const).map((days) => (
              <button
                aria-pressed={period === days}
                className={period === days ? styles.periodActive : styles.periodButton}
                key={days}
                onClick={() => {
                  if (period === days) return
                  setStatisticsError('')
                  setStatisticsLoading(true)
                  setPeriod(days)
                }}
                type="button"
              >
                {days} ngày
              </button>
            ))}
          </div>
        </div>

        {statisticsError ? (
          <div className={styles.statisticsError} role="alert">
            <div>
              <strong>Chưa thể tải biểu đồ</strong>
              <p>{statisticsError}</p>
            </div>
            <button
              className={styles.retryButton}
              disabled={statisticsLoading}
              onClick={() => {
                setStatisticsError('')
                setStatisticsLoading(true)
                setStatisticsRetry((attempt) => attempt + 1)
              }}
              type="button"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Thử lại
            </button>
          </div>
        ) : (
          <div className={styles.chartGrid} aria-busy={statisticsLoading}>
            <ChartCard
              countLabel="bài nộp"
              data={statistics?.submissions.daily ?? []}
              loading={statisticsLoading}
              period={period}
              title={submissionScope === 'GLOBAL' ? 'Xu hướng bài nộp công khai' : 'Xu hướng bài nộp'}
              total={statistics?.submissions.total ?? 0}
              type="line"
              scope={submissionScope}
              onScopeChange={(scope) => {
                if (submissionScope === scope) return
                setStatisticsError('')
                setStatisticsLoading(true)
                setSubmissionScope(scope)
              }}
            />
            <ChartCard
              countLabel="người dùng mới"
              data={statistics?.users.daily ?? []}
              loading={statisticsLoading}
              period={period}
              title="Tăng trưởng người dùng"
              total={statistics?.users.total ?? 0}
              type="bar"
            />
          </div>
        )}
      </section>
    </div>
  )
}

type ChartPoint = { date: string; count: number }
type ChartCardProps = {
  countLabel: string
  data: ChartPoint[]
  loading: boolean
  period: DashboardPeriod
  title: string
  total: number
  type: 'line' | 'bar'
  scope?: SubmissionScope
  onScopeChange?: (scope: SubmissionScope) => void
}

function ChartCard({
  countLabel,
  data,
  loading,
  period,
  title,
  total,
  type,
  scope,
  onScopeChange,
}: ChartCardProps) {
  const isEmpty = !loading && total === 0
  const chartDescription = `${title}, ${period} ngày gần nhất, tổng ${formatNumber(total)} ${countLabel}`

  return (
    <article className={styles.chartCard}>
      <header className={styles.chartHeader}>
        <div>
          <h2>{title}</h2>
          <p>
            <strong>{formatNumber(total)}</strong>
            <span>{countLabel} trong {period} ngày</span>
          </p>
          <div className={styles.chartLegend}>
            <span className={type === 'line' ? styles.lineLegend : styles.barLegend} aria-hidden="true" />
            {type === 'line'
              ? `Bài nộp ${scope === 'ORGANIZATION' ? 'Organization' : 'Global'}`
              : 'Tài khoản đăng ký mới'}
          </div>
        </div>
        {onScopeChange && scope && (
          <label className={styles.scopeControl}>
            <span>Phạm vi bài nộp</span>
            <select
              aria-label="Phạm vi bài nộp"
              onChange={(event) => {
                onScopeChange(
                  event.currentTarget.value === 'ORGANIZATION' ? 'ORGANIZATION' : 'GLOBAL',
                )
              }}
              value={scope}
            >
              <option value="GLOBAL">Global</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </label>
        )}
      </header>

      {scope === 'GLOBAL' && (
        <p className={styles.chartDescription}>
          Số bài nộp trên các bài tập Global đã xuất bản trong khoảng thời gian được chọn.
        </p>
      )}

      {loading ? (
        <div className={styles.chartSkeleton} aria-label={`Đang tải ${title.toLocaleLowerCase('vi-VN')}`}>
          <span />
          <span />
          <span />
        </div>
      ) : isEmpty ? (
        <div className={styles.chartEmpty} role="status">
          Chưa có {countLabel} trong khoảng thời gian này.
        </div>
      ) : (
        <>
          {type === 'line' ? (
            <LineChart data={data} description={chartDescription} />
          ) : (
            <BarChart data={data} description={chartDescription} />
          )}
          <details className={styles.dataDetails}>
            <summary>Xem dữ liệu dạng bảng</summary>
            <table>
              <caption>{chartDescription}</caption>
              <thead>
                <tr><th scope="col">Ngày</th><th scope="col">{countLabel}</th></tr>
              </thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.date}><th scope="row">{point.date}</th><td>{formatNumber(point.count)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </article>
  )
}

const plot = { left: 48, right: 704, top: 20, bottom: 185 }

function axisLabel(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

function visibleLabelIndexes(length: number) {
  const interval = Math.max(1, Math.ceil((length - 1) / 5))
  const indexes = Array.from({ length }, (_, index) => index).filter(
    (index) => index % interval === 0,
  )
  if (length > 1 && indexes[indexes.length - 1] !== length - 1) indexes.push(length - 1)
  return indexes
}

function LineChart({ data, description }: { data: ChartPoint[]; description: string }) {
  const max = Math.max(1, ...data.map((point) => point.count))
  const points = data.map((point, index) => ({
    ...point,
    x: data.length <= 1
      ? plot.left + (plot.right - plot.left) / 2
      : plot.left + (index / (data.length - 1)) * (plot.right - plot.left),
    y: plot.bottom - (point.count / max) * (plot.bottom - plot.top),
  }))
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const labels = visibleLabelIndexes(data.length)

  return (
    <svg
      aria-label={description}
      className={styles.chartSvg}
      role="img"
      viewBox="0 0 720 232"
      preserveAspectRatio="none"
    >
      {[0, 0.5, 1].map((fraction) => {
        const y = plot.bottom - fraction * (plot.bottom - plot.top)
        const value = Math.round(max * fraction)
        return (
          <g key={fraction}>
            <line className={styles.gridLine} x1={plot.left} x2={plot.right} y1={y} y2={y} />
            <text className={styles.axisText} textAnchor="end" x={plot.left - 10} y={y + 4}>{formatNumber(value)}</text>
          </g>
        )
      })}
      <polyline className={styles.linePath} points={line} />
      {points.map((point) => (
        <circle
          className={styles.linePoint}
          cx={point.x}
          cy={point.y}
          key={point.date}
          r="4"
          tabIndex={0}
          aria-label={`${point.date}: ${formatNumber(point.count)} bài nộp`}
        >
          <title>{point.date}: {formatNumber(point.count)} bài nộp</title>
        </circle>
      ))}
      {labels.map((index) => (
        <text className={styles.axisText} key={data[index]?.date} textAnchor="middle" x={points[index]?.x} y="216">
          {data[index] ? axisLabel(data[index].date) : ''}
        </text>
      ))}
    </svg>
  )
}

function BarChart({ data, description }: { data: ChartPoint[]; description: string }) {
  const max = Math.max(1, ...data.map((point) => point.count))
  const width = (plot.right - plot.left) / Math.max(data.length, 1)
  const barWidth = Math.max(2, width * 0.58)
  const labels = visibleLabelIndexes(data.length)

  return (
    <svg
      aria-label={description}
      className={styles.chartSvg}
      role="img"
      viewBox="0 0 720 232"
      preserveAspectRatio="none"
    >
      {[0, 0.5, 1].map((fraction) => {
        const y = plot.bottom - fraction * (plot.bottom - plot.top)
        return (
          <g key={fraction}>
            <line className={styles.gridLine} x1={plot.left} x2={plot.right} y1={y} y2={y} />
            <text className={styles.axisText} textAnchor="end" x={plot.left - 10} y={y + 4}>
              {formatNumber(Math.round(max * fraction))}
            </text>
          </g>
        )
      })}
      {data.map((point, index) => {
        const height = (point.count / max) * (plot.bottom - plot.top)
        const x = plot.left + index * width + (width - barWidth) / 2
        const y = plot.bottom - height
        return (
          <rect
            className={styles.bar}
            height={Math.max(height, point.count > 0 ? 2 : 0)}
            key={point.date}
            rx="3"
            tabIndex={0}
            aria-label={`${point.date}: ${formatNumber(point.count)} người dùng mới`}
            width={barWidth}
            x={x}
            y={point.count > 0 ? y : plot.bottom}
          >
            <title>{point.date}: {formatNumber(point.count)} người dùng mới</title>
          </rect>
        )
      })}
      {labels.map((index) => (
        <text
          className={styles.axisText}
          key={data[index]?.date}
          textAnchor="middle"
          x={plot.left + index * width + width / 2}
          y="216"
        >
          {data[index] ? axisLabel(data[index].date) : ''}
        </text>
      ))}
    </svg>
  )
}

function MetricCard({ label, value, detail, icon, tone }: MetricCardProps) {
  return (
    <article className={styles.metricCard}>
      <span className={`${styles.metricIcon} ${styles[tone]}`}>{icon}</span>
      <p>{label}</p>
      <strong>{formatNumber(value)}</strong>
      <small>{detail}</small>
    </article>
  )
}

export default AdminDashboardPage
