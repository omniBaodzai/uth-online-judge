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
import { useContestText } from '../translate'
import styles from './ContestStatisticsTab.module.css'

const verdictColors: Record<ContestVerdict, string> = {
  AC: '#16A34A',
  WA: '#EA580C',
  CE: '#64748B',
  TLE: '#94A3B8',
  ERR: '#F59E0B',
}

function verdictLabel(verdict: ContestVerdict, text: ReturnType<typeof useContestText>['text']): string {
  if (verdict === 'AC') return text('verdictAC', 'AC — Đúng', 'AC — Accepted')
  if (verdict === 'WA') return text('verdictWA', 'WA — Sai đáp án', 'WA — Wrong Answer')
  if (verdict === 'CE') return text('verdictCE', 'CE — Lỗi biên dịch', 'CE — Compilation Error')
  if (verdict === 'TLE') return text('verdictTLE', 'TLE — Quá thời gian', 'TLE — Time Limit Exceeded')
  return text('verdictOther', 'ERR — Lỗi khác', 'ERR — Other errors')
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
  const { text, locale } = useContestText()
  const maxTotal = Math.max(1, ...statistics.problems.map(({ total }) => total))
  const chartHeight = CHART_PADDING_TOP + statistics.problems.length * ROW_HEIGHT + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const tickStep = Math.max(1, Math.ceil(maxTotal / 4))
  const ticks = Array.from({ length: Math.floor(maxTotal / tickStep) + 1 }, (_, index) => index * tickStep)
  if (ticks[ticks.length - 1] !== maxTotal) ticks.push(maxTotal)

  return (
    <ChartCard
      title={text('submissionDistributionTitle', 'Phân phối theo trạng thái', 'Submission verdict distribution')}
      className={styles.statusCard}
      headerContent={
        <span className={styles.totalBadge}>
          {formatSubmissionCount(statistics.totalSubmissions, locale)} {text('submissions', 'bài nộp', 'submissions')}
        </span>
      }
    >
      <ChartLegend items={contestVerdicts.map((verdict) => ({
        label: verdictLabel(verdict, text),
        color: verdictColors[verdict],
      }))} />
      <div className={styles.chartScroll} role="region" aria-label={text('submissionDistributionChart', 'Biểu đồ phân phối bài nộp theo trạng thái', 'Submission verdict distribution chart')} tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label={text('submissionDistributionChartDescription', 'Biểu đồ thanh ngang chồng phân phối bài nộp theo trạng thái của từng bài', 'Stacked horizontal bar chart of submission verdicts for each problem')}
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / maxTotal) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick.toLocaleString(locale)}</text>
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
                  const label = verdictLabel(verdict, text)
                  const countLabel = formatSubmissionCount(count, locale)
                  return (
                    <g
                      key={verdict}
                      tabIndex={0}
                      aria-label={text('problemVerdictLabel', '{{problem}}: {{verdict}}, {{count}} bài nộp', '{{problem}}: {{verdict}}, {{count}} submissions', { problem: problemStats.problem.title, verdict: label, count: countLabel })}
                    >
                      <title>{text('problemVerdictTitle', '{{problem}} · {{verdict}}: {{count}} bài nộp', '{{problem}} · {{verdict}}: {{count}} submissions', { problem: problemStats.problem.title, verdict: label, count: countLabel })}</title>
                      <rect
                        x={x}
                        y={y + 7}
                        width={width}
                        height={22}
                        fill={verdictColors[verdict]}
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
            {text('submissionCountAxis', 'Số lượng bài nộp', 'Number of submissions')}
          </text>
        </svg>
      </div>
    </ChartCard>
  )
}

function ProblemAcceptanceChart({ statistics }: { statistics: ContestStatistics }) {
  const { text, locale } = useContestText()
  const chartHeight = CHART_PADDING_TOP + statistics.problems.length * ROW_HEIGHT + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const ticks = [0, 25, 50, 75, 100]

  return (
    <ChartCard title={text('problemAcceptanceTitle', 'Tỉ lệ AC theo bài tập', 'Acceptance rate by problem')} className={styles.acceptanceCard}>
      <div className={styles.chartScroll} role="region" aria-label={text('problemAcceptanceChart', 'Biểu đồ tỉ lệ AC theo bài tập', 'Problem acceptance rate chart')} tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label={text('problemAcceptanceChartDescription', 'Biểu đồ thanh ngang tỉ lệ Accepted theo từng bài tập', 'Horizontal bar chart of accepted submission rates by problem')}
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / 100) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick.toLocaleString(locale)}%</text>
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
                aria-label={text('problemAcceptanceLabel', '{{problem}}: {{accepted}} AC trên {{total}}, {{rate}}', '{{problem}}: {{accepted}} AC out of {{total}}, {{rate}}', {
                  problem: problemStats.problem.title,
                  accepted: formatSubmissionCount(problemStats.accepted, locale),
                  total: formatSubmissionCount(problemStats.total, locale),
                  rate: formatPercent(safeRate, locale),
                })}
              >
                <title>{text('problemAcceptanceTitleTooltip', '{{problem}} · {{accepted}} AC / {{total}} bài nộp · {{rate}}', '{{problem}} · {{accepted}} AC / {{total}} submissions · {{rate}}', {
                  problem: problemStats.problem.title,
                  accepted: formatSubmissionCount(problemStats.accepted, locale),
                  total: formatSubmissionCount(problemStats.total, locale),
                  rate: formatPercent(safeRate, locale),
                })}</title>
                <ProblemLabels stats={problemStats} y={y + ROW_HEIGHT / 2} />
                <rect x={LABEL_WIDTH} y={y + 9} width={plotWidth} height={18} rx={9} className={styles.barTrack} />
                <rect x={LABEL_WIDTH} y={y + 9} width={width} height={18} rx={9} className={styles.acceptanceBar} />
                <text x={LABEL_WIDTH + plotWidth + 10} y={y + ROW_HEIGHT / 2 + 4} className={styles.valueLabel}>
                  {formatPercent(safeRate, locale)}
                </text>
              </g>
            )
          })}
          <text x={LABEL_WIDTH + plotWidth / 2} y={chartHeight - 1} textAnchor="middle" className={styles.axisTitle}>
            {text('acceptanceRateAxis', 'Tỉ lệ Accepted', 'Acceptance rate')}
          </text>
        </svg>
      </div>
    </ChartCard>
  )
}

function LanguageDistributionChart({ statistics }: { statistics: ContestStatistics }) {
  const { text, locale } = useContestText()
  const total = statistics.totalSubmissions
  const radius = 72
  const circumference = 2 * Math.PI * radius

  return (
    <ChartCard title={text('languageDistributionTitle', 'Bài nộp theo ngôn ngữ', 'Submissions by language')} className={styles.languageCard}>
      <div className={styles.languageLayout}>
        <div className={styles.donutWrap}>
          <svg viewBox="0 0 220 220" role="group" aria-label={text('languageDistributionChart', 'Biểu đồ donut số bài nộp theo ngôn ngữ', 'Donut chart of submissions by language')}>
            <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="28" />
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
                  aria-label={text('languageSubmissionLabel', '{{language}}: {{count}} bài nộp, {{percent}}', '{{language}}: {{count}} submissions, {{percent}}', {
                    language: languageStats.language,
                    count: formatSubmissionCount(languageStats.total, locale),
                    percent: formatPercent(share * 100, locale),
                  })}
                >
                  <title>{text('languageSubmissionTitle', '{{language}}: {{count}} bài nộp · {{percent}}', '{{language}}: {{count}} submissions · {{percent}}', {
                    language: languageStats.language,
                    count: formatSubmissionCount(languageStats.total, locale),
                    percent: formatPercent(share * 100, locale),
                  })}</title>
                </circle>
              )
            })}
            <text x="110" y="106" textAnchor="middle" className={styles.donutTotal}>
              {formatSubmissionCount(total, locale)}
            </text>
            <text x="110" y="128" textAnchor="middle" className={styles.donutLabel}>
              {text('submissions', 'bài nộp', 'submissions')}
            </text>
          </svg>
        </div>
        <ChartLegend items={statistics.languages.map((languageStats, index) => ({
          label: languageStats.language,
          color: languageColors[index % languageColors.length],
          value: `${formatSubmissionCount(languageStats.total, locale)} · ${formatPercent(total > 0 ? (languageStats.total / total) * 100 : 0, locale)}`,
        }))} />
      </div>
    </ChartCard>
  )
}

function LanguageAcceptanceChart({ statistics }: { statistics: ContestStatistics }) {
  const { text, locale } = useContestText()
  const chartHeight = CHART_PADDING_TOP + statistics.languages.length * 52 + CHART_PADDING_BOTTOM
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - RIGHT_PADDING
  const ticks = [0, 25, 50, 75, 100]

  return (
    <ChartCard title={text('languageAcceptanceTitle', 'Tỉ lệ AC theo ngôn ngữ', 'Acceptance rate by language')} className={styles.acceptanceCard}>
      <div className={styles.chartScroll} role="region" aria-label={text('languageAcceptanceChart', 'Biểu đồ tỉ lệ AC theo ngôn ngữ', 'Language acceptance rate chart')} tabIndex={0}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="group"
          aria-label={text('languageAcceptanceChartDescription', 'Biểu đồ thanh ngang tỉ lệ Accepted theo ngôn ngữ lập trình', 'Horizontal bar chart of accepted submission rates by programming language')}
        >
          {ticks.map((tick) => {
            const x = LABEL_WIDTH + (tick / 100) * plotWidth
            return (
              <g key={tick}>
                <line x1={x} y1={CHART_PADDING_TOP - 3} x2={x} y2={chartHeight - CHART_PADDING_BOTTOM + 2} className={styles.gridLine} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" className={styles.axisTick}>{tick.toLocaleString(locale)}%</text>
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
                aria-label={text('languageAcceptanceLabel', '{{language}}: {{accepted}} AC trên {{total}}, {{rate}}', '{{language}}: {{accepted}} AC out of {{total}}, {{rate}}', {
                  language: languageStats.language,
                  accepted: formatSubmissionCount(languageStats.accepted, locale),
                  total: formatSubmissionCount(languageStats.total, locale),
                  rate: formatPercent(safeRate, locale),
                })}
              >
                <title>{text('languageAcceptanceTooltip', '{{language}} · {{accepted}} AC / {{total}} bài nộp · {{rate}}', '{{language}} · {{accepted}} AC / {{total}} submissions · {{rate}}', {
                  language: languageStats.language,
                  accepted: formatSubmissionCount(languageStats.accepted, locale),
                  total: formatSubmissionCount(languageStats.total, locale),
                  rate: formatPercent(safeRate, locale),
                })}</title>
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
                  {formatPercent(safeRate, locale)}
                </text>
              </g>
            )
          })}
          <text x={LABEL_WIDTH + plotWidth / 2} y={chartHeight - 1} textAnchor="middle" className={styles.axisTitle}>
            {text('acceptanceRateAxis', 'Tỉ lệ Accepted', 'Acceptance rate')}
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
  const { text } = useContestText()
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
              : text('statisticsRequestError', 'Không thể tải thống kê cuộc thi. Vui lòng thử lại.', 'Could not load contest statistics. Please try again.'),
          },
        })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [identifier, key, requester, text])

  if (state.phase === 'loading') {
    return (
      <section className={styles.emptyState} role="status" aria-live="polite">
        <h2>{text('statisticsLoading', 'Đang tải thống kê…', 'Loading statistics…')}</h2>
      </section>
    )
  }

  if (state.phase === 'error') {
    return (
      <section className={styles.emptyState} role="alert">
        <h2>{text('statisticsLoadError', 'Không thể tải thống kê', 'Could not load statistics')}</h2>
        <p>{state.message}</p>
        <button type="button" className={styles.retryButton} onClick={() => setRetryKey((value) => value + 1)}>
          {text('retry', 'Thử lại', 'Retry')}
        </button>
      </section>
    )
  }

  const statistics = toChartStatistics(state.statistics)
  if (statistics.totalSubmissions === 0) {
    return (
      <section className={styles.emptyState} aria-label={text('statisticsLabel', 'Thống kê cuộc thi', 'Contest statistics')}>
        <h2>{text('noSubmissions', 'Chưa có bài nộp', 'No submissions yet')}</h2>
        <p>{text('statisticsWillAppear', 'Thống kê sẽ xuất hiện khi có bài nộp trong cuộc thi này.', 'Statistics will appear once this contest has submissions.')}</p>
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
