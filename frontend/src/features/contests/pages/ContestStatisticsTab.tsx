import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ApiError } from '../../auth/api'
import {
  contestVerdicts,
  formatPercent,
  formatSubmissionCount,
  type ContestStatistics,
  type ContestVerdict,
  type LanguageContestStats,
  type ProblemContestStats,
} from '../statistics'
import {
  getStudentContestStatistics,
  type StudentContestRequester,
  type StudentContestStatistics,
} from '../student-contests.api'
import styles from './ContestStatisticsTab.module.css'

const verdictDetails: Record<ContestVerdict, { label: string; color: string }> = {
  AC: { label: 'AC — Accepted', color: '#16A34A' },
  WA: { label: 'WA — Wrong Answer', color: '#EA580C' },
  CE: { label: 'CE — Compilation Error', color: '#64748B' },
  TLE: { label: 'TLE — Time Limit Exceeded', color: '#94A3B8' },
  ERR: { label: 'ERR — Other Errors', color: '#F59E0B' },
}

const languageColors = ['#008689', '#4F46E5', '#D97706', '#0F766E', '#DB2777']
const CHART_WIDTH = 960
const LABEL_WIDTH = 230
const RIGHT_PADDING = 70
const CHART_PADDING_TOP = 18
const CHART_PADDING_BOTTOM = 38
const ROW_HEIGHT = 36

type ChartCardProps = {
  title: string
  children: ReactNode
  className?: string
  headerContent?: ReactNode
}

function ChartCard({ title, children, className = '', headerContent }: ChartCardProps) {
  return (
    <section className={`${styles.card} ${className}`} aria-label={title}>
      <header className={styles.cardHeader}>
        <h2>{title}</h2>
        {headerContent}
      </header>
      {children}
    </section>
  )
}

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string; value?: string }>
}) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value ? <strong>{item.value}</strong> : null}
        </li>
      ))}
    </ul>
  )
}

function ProblemLabels({ stats, y }: { stats: ProblemContestStats; y: number }) {
  const label = stats.problem.title.length > 27
    ? `${stats.problem.title.slice(0, 26)}…`
    : stats.problem.title
  return (
    <text x={LABEL_WIDTH - 14} y={y + 4} textAnchor="end" className={styles.axisLabel}>
      <title>{stats.problem.title}</title>
      {label}
    </text>
  )
}

function toChartVerdict(status: string): ContestVerdict {
  if (status === 'ACCEPTED') return 'AC'
  if (status === 'WRONG_ANSWER') return 'WA'
  if (status === 'COMPILATION_ERROR') return 'CE'
  if (status === 'TIME_LIMIT_EXCEEDED') return 'TLE'
  return 'ERR'
}

function mapStatusCounts(statusCounts: StudentContestStatistics['statusCounts']) {
  const counts: Record<ContestVerdict, number> = { AC: 0, WA: 0, CE: 0, TLE: 0, ERR: 0 }
  for (const { status, count } of statusCounts) {
    counts[toChartVerdict(status)] += count
  }
  return counts
}

function toChartStatistics(data: StudentContestStatistics): ContestStatistics {
  const problems = data.problemStatistics.map((problem) => {
    const counts = mapStatusCounts(problem.statusCounts)
    const total = problem.totalSubmissions
    return {
      problem: { id: problem.problemId, title: problem.problemTitle },
      counts,
      total,
      accepted: problem.acceptedSubmissions,
      acceptanceRate: total > 0 ? (problem.acceptedSubmissions / total) * 100 : 0,
    }
  })
  const languages = data.languageStatistics.map((language) => {
    const counts = mapStatusCounts(language.statusCounts)
    const total = language.totalSubmissions
    return {
      language: language.languageName,
      counts,
      total,
      accepted: language.acceptedSubmissions,
      acceptanceRate: total > 0 ? (language.acceptedSubmissions / total) * 100 : 0,
    }
  })

  return {
    submissions: [],
    problems,
    languages,
    verdictTotals: mapStatusCounts(data.statusCounts),
    totalSubmissions: data.totalSubmissions,
  }
}

function SubmissionStatusChart({ statistics }: { statistics: ContestStatistics }) {
  const maxTotal = Math.max(1, ...statistics.problems.map(({ total }) => total))
  const chartHeight = CHART_PADDING_TOP + statistics.problems.length * ROW_HEIGHT + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const tickStep = Math.max(1, Math.ceil(maxTotal / 4))
  const ticks = Array.from({ length: Math.floor(maxTotal / tickStep) + 1 }, (_, index) => index * tickStep)
  if (ticks[ticks.length - 1] !== maxTotal) ticks.push(maxTotal)

  return (
    <ChartCard
      title="Phân phối theo trạng thái"
      className={styles.statusCard}
      headerContent={
        <span className={styles.totalBadge}>
          {formatSubmissionCount(statistics.totalSubmissions)} bài nộp
        </span>
      }
    >
      <ChartLegend items={contestVerdicts.map((verdict) => ({
        label: verdictDetails[verdict].label,
        color: verdictDetails[verdict].color,
      }))} />
      <div className={styles.chartScroll} role="region" aria-label="Biểu đồ phân phối bài nộp theo trạng thái" tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label="Biểu đồ thanh ngang chồng phân phối bài nộp theo trạng thái của từng bài"
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / maxTotal) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick}</text>
              </g>
            )
          })}
          {statistics.problems.map((problemStats, index) => {
            const y = CHART_PADDING_TOP + index * ROW_HEIGHT
            let currentX = LABEL_WIDTH
            return (
              <g key={problemStats.problem.id}>
                <ProblemLabels stats={problemStats} y={y + ROW_HEIGHT / 2} />
                {contestVerdicts.map((verdict) => {
                  const count = problemStats.counts[verdict]
                  const width = (count / maxTotal) * plotWidth
                  const x = currentX
                  currentX += width
                  if (width <= 0) return null
                  const details = verdictDetails[verdict]
                  return (
                    <g
                      key={verdict}
                      tabIndex={0}
                      aria-label={`${problemStats.problem.title}: ${details.label}, ${formatSubmissionCount(count)} bài nộp`}
                    >
                      <title>{`${problemStats.problem.title} · ${details.label}: ${formatSubmissionCount(count)} bài nộp`}</title>
                      <rect
                        x={x}
                        y={y + 7}
                        width={width}
                        height={22}
                        fill={details.color}
                        rx={currentX === LABEL_WIDTH + width ? 4 : 0}
                        className={styles.barSegment}
                      />
                    </g>
                  )
                })}
              </g>
            )
          })}
          <text x={LABEL_WIDTH + plotWidth / 2} y={chartHeight - 1} textAnchor="middle" className={styles.axisTitle}>
            Số lượng bài nộp
          </text>
        </svg>
      </div>
    </ChartCard>
  )
}

function ProblemAcceptanceChart({ statistics }: { statistics: ContestStatistics }) {
  const chartHeight = CHART_PADDING_TOP + statistics.problems.length * ROW_HEIGHT + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const ticks = [0, 25, 50, 75, 100]

  return (
    <ChartCard title="Tỉ lệ AC theo bài tập" className={styles.acceptanceCard}>
      <div className={styles.chartScroll} role="region" aria-label="Biểu đồ tỉ lệ AC theo bài tập" tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label="Biểu đồ thanh ngang tỉ lệ Accepted theo từng bài tập"
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / 100) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick}%</text>
              </g>
            )
          })}
          {statistics.problems.map((problemStats, index) => {
            const y = CHART_PADDING_TOP + index * ROW_HEIGHT
            const safeRate = Math.min(100, Math.max(0, problemStats.acceptanceRate))
            const width = (safeRate / 100) * plotWidth
            return (
              <g
                key={problemStats.problem.id}
                tabIndex={0}
                aria-label={`${problemStats.problem.title}: ${formatSubmissionCount(problemStats.accepted)} AC trên ${formatSubmissionCount(problemStats.total)}, ${formatPercent(safeRate)}`}
              >
                <title>{`${problemStats.problem.title} · ${problemStats.accepted} AC / ${problemStats.total} bài nộp · ${formatPercent(safeRate)}`}</title>
                <ProblemLabels stats={problemStats} y={y + ROW_HEIGHT / 2} />
                <rect x={LABEL_WIDTH} y={y + 9} width={plotWidth} height={18} rx={9} className={styles.barTrack} />
                <rect x={LABEL_WIDTH} y={y + 9} width={width} height={18} rx={9} className={styles.acceptanceBar} />
                <text x={LABEL_WIDTH + plotWidth + 10} y={y + ROW_HEIGHT / 2 + 4} className={styles.valueLabel}>
                  {formatPercent(safeRate)}
                </text>
              </g>
            )
          })}
          <text x={LABEL_WIDTH + plotWidth / 2} y={chartHeight - 1} textAnchor="middle" className={styles.axisTitle}>
            Tỉ lệ Accepted
          </text>
        </svg>
      </div>
    </ChartCard>
  )
}

function LanguageDistributionChart({ statistics }: { statistics: ContestStatistics }) {
  const total = statistics.totalSubmissions
  const radius = 72
  const circumference = 2 * Math.PI * radius

  return (
    <ChartCard title="Bài nộp theo ngôn ngữ" className={styles.languageCard}>
      <div className={styles.languageLayout}>
        <div className={styles.donutWrap}>
          <svg viewBox="0 0 220 220" role="group" aria-label="Biểu đồ donut số bài nộp theo ngôn ngữ">
            <circle cx="110" cy="110" r={radius} fill="none" stroke="#e8eeee" strokeWidth="28" />
            {statistics.languages.map((languageStats, index) => {
              const share = total > 0 ? languageStats.total / total : 0
              const dashLength = share * circumference
              const previousLength = statistics.languages
                .slice(0, index)
                .reduce((sum, previous) => sum + (total > 0 ? (previous.total / total) * circumference : 0), 0)
              const dashOffset = -previousLength
              if (dashLength <= 0) return null
              return (
                <circle
                  key={languageStats.language}
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="none"
                  stroke={languageColors[index % languageColors.length]}
                  strokeWidth="28"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 110 110)"
                  tabIndex={0}
                  aria-label={`${languageStats.language}: ${formatSubmissionCount(languageStats.total)} bài nộp, ${formatPercent(share * 100)}`}
                >
                  <title>{`${languageStats.language}: ${formatSubmissionCount(languageStats.total)} bài nộp · ${formatPercent(share * 100)}`}</title>
                </circle>
              )
            })}
            <text x="110" y="106" textAnchor="middle" className={styles.donutTotal}>
              {formatSubmissionCount(total)}
            </text>
            <text x="110" y="128" textAnchor="middle" className={styles.donutLabel}>
              bài nộp
            </text>
          </svg>
        </div>
        <ChartLegend items={statistics.languages.map((languageStats, index) => ({
          label: languageStats.language,
          color: languageColors[index % languageColors.length],
          value: `${formatSubmissionCount(languageStats.total)} · ${formatPercent(total > 0 ? (languageStats.total / total) * 100 : 0)}`,
        }))} />
      </div>
    </ChartCard>
  )
}

function LanguageAcceptanceChart({ statistics }: { statistics: ContestStatistics }) {
  const chartHeight = CHART_PADDING_TOP + statistics.languages.length * 52 + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const ticks = [0, 25, 50, 75, 100]

  return (
    <ChartCard title="Tỉ lệ AC theo ngôn ngữ" className={styles.acceptanceCard}>
      <div className={styles.chartScroll} role="region" aria-label="Biểu đồ tỉ lệ AC theo ngôn ngữ" tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label="Biểu đồ thanh ngang tỉ lệ Accepted theo ngôn ngữ lập trình"
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / 100) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick}%</text>
              </g>
            )
          })}
          {statistics.languages.map((languageStats: LanguageContestStats, index) => {
            const rowHeight = 52
            const y = CHART_PADDING_TOP + index * rowHeight
            const safeRate = Math.min(100, Math.max(0, languageStats.acceptanceRate))
            const width = (safeRate / 100) * plotWidth
            return (
              <g
                key={languageStats.language}
                tabIndex={0}
                aria-label={`${languageStats.language}: ${formatSubmissionCount(languageStats.accepted)} AC trên ${formatSubmissionCount(languageStats.total)}, ${formatPercent(safeRate)}`}
              >
                <title>{`${languageStats.language} · ${languageStats.accepted} AC / ${languageStats.total} bài nộp · ${formatPercent(safeRate)}`}</title>
                <text x={LABEL_WIDTH - 14} y={y + rowHeight / 2 + 4} textAnchor="end" className={styles.axisLabel}>
                  {languageStats.language}
                </text>
                <rect x={LABEL_WIDTH} y={y + 15} width={plotWidth} height={20} rx={10} className={styles.barTrack} />
                <rect
                  x={LABEL_WIDTH}
                  y={y + 15}
                  width={width}
                  height={20}
                  rx={10}
                  fill={languageColors[index % languageColors.length]}
                  className={styles.languageBar}
                />
                <text x={LABEL_WIDTH + plotWidth + 10} y={y + rowHeight / 2 + 4} className={styles.valueLabel}>
                  {formatPercent(safeRate)}
                </text>
              </g>
            )
          })}
          <text x={LABEL_WIDTH + plotWidth / 2} y={chartHeight - 1} textAnchor="middle" className={styles.axisTitle}>
            Tỉ lệ Accepted
          </text>
        </svg>
      </div>
    </ChartCard>
  )
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; statistics: StudentContestStatistics }

function ContestStatisticsTab({
  identifier,
  requester,
}: {
  identifier: string
  requester: StudentContestRequester
}) {
  const [retryKey, setRetryKey] = useState(0)
  const [result, setResult] = useState<{ key: string; state: LoadState }>()
  const key = `${identifier}:${retryKey}`
  const state = result?.key === key ? result.state : { phase: 'loading' as const }

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void getStudentContestStatistics(requester, identifier, controller.signal)
      .then((statistics) => {
        if (active) setResult({ key, state: { phase: 'ready', statistics } })
      })
      .catch((error: unknown) => {
        if (!active) return
        setResult({
          key,
          state: {
            phase: 'error',
            message: error instanceof ApiError
              ? error.message
              : 'Không thể tải thống kê cuộc thi. Vui lòng thử lại.',
          },
        })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [identifier, key, requester])

  if (state.phase === 'loading') {
    return (
      <section className={styles.emptyState} role="status" aria-live="polite">
        <h2>Đang tải thống kê…</h2>
      </section>
    )
  }

  if (state.phase === 'error') {
    return (
      <section className={styles.emptyState} role="alert">
        <h2>Không thể tải thống kê</h2>
        <p>{state.message}</p>
        <button type="button" className={styles.retryButton} onClick={() => setRetryKey((value) => value + 1)}>
          Thử lại
        </button>
      </section>
    )
  }

  const statistics = toChartStatistics(state.statistics)
  if (statistics.totalSubmissions === 0) {
    return (
      <section className={styles.emptyState} aria-label="Thống kê cuộc thi">
        <h2>Chưa có bài nộp</h2>
        <p>Thống kê sẽ xuất hiện khi có bài nộp trong cuộc thi này.</p>
      </section>
    )
  }

  return (
    <div className={styles.statistics}>
      <SubmissionStatusChart statistics={statistics} />
      <ProblemAcceptanceChart statistics={statistics} />
      <LanguageDistributionChart statistics={statistics} />
      <LanguageAcceptanceChart statistics={statistics} />
    </div>
  )
}

export default ContestStatisticsTab
