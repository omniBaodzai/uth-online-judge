import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import {
  getMyProblemSubmissions,
  type ProblemSubmissionFilters,
  type ProblemSubmissionListItem,
  type ProblemSubmissionPage,
} from '../../problems/submit/submission-service'
import SubmissionPagination from '../components/SubmissionPagination'
import { getSubmissionVerdictDistribution, submissionVerdicts } from '../data/submission-verdicts'
import { formatMemoryMiB } from '../submission-metrics'
import styles from './MyProblemSubmissionsPage.module.css'

const PAGE_SIZES = [10, 20, 50]
const POLL_INTERVAL_MS = 2200

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  QUEUED: 'Đang chờ',
  RUNNING: 'Đang chấm',
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
  RUNTIME_ERROR: 'Runtime Error',
  COMPILATION_ERROR: 'Compilation Error',
  INTERNAL_ERROR: 'Lỗi hệ thống',
}

const STATUS_OPTIONS = [
  ['PENDING', 'Chờ xử lý'],
  ['QUEUED', 'Đang chờ'],
  ['RUNNING', 'Đang chấm'],
  ['ACCEPTED', 'Accepted'],
  ['WRONG_ANSWER', 'Wrong Answer'],
  ['TIME_LIMIT_EXCEEDED', 'Time Limit Exceeded'],
  ['MEMORY_LIMIT_EXCEEDED', 'Memory Limit Exceeded'],
  ['RUNTIME_ERROR', 'Runtime Error'],
  ['COMPILATION_ERROR', 'Compilation Error'],
  ['INTERNAL_ERROR', 'Lỗi hệ thống'],
] as const

function isActive(item: ProblemSubmissionListItem): boolean {
  return ['PENDING', 'QUEUED', 'RUNNING'].includes(item.status)
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function formatExecutionTime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value / 1000).toFixed(2).replace('.', ',')}s`
}

function formatMemory(value: number | null): string {
  return formatMemoryMiB(value)
}

function verdictAbbr(status: string): string {
  return submissionVerdicts.find((verdict) => verdict.status === status)?.abbr ?? status
}

function submissionStatusClass(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return styles.accepted
    case 'WRONG_ANSWER':
      return styles.wrongAnswer
    case 'TIME_LIMIT_EXCEEDED':
      return styles.timeLimit
    case 'MEMORY_LIMIT_EXCEEDED':
      return styles.memoryLimit
    case 'RUNTIME_ERROR':
      return styles.runtimeError
    case 'COMPILATION_ERROR':
      return styles.compilationError
    case 'QUEUED':
    case 'PENDING':
    case 'RUNNING':
      return styles.pending
    default:
      return styles.internalError
  }
}

function SubmissionCard({ item, username }: { item: ProblemSubmissionListItem; username: string }) {
  const detailsPath = `/submissions/${encodeURIComponent(item.id)}?from=my-submissions`
  const showScore = item.scoringEnabled && item.score !== null && item.maxScore !== null
  const active = isActive(item)
  const statusLabel = STATUS_LABELS[item.status] ?? item.status.replaceAll('_', ' ')

  return (
    <li className={styles.submission}>
      <div
        className={`${styles.verdictBlock} ${submissionStatusClass(item.status)}`}
        role="status"
        aria-label={`${statusLabel}${showScore ? `, điểm lần nộp ${item.score}/${item.maxScore}` : ''}`}
      >
        <strong>
          {showScore ? `${item.score} / ${item.maxScore}` : active ? statusLabel : verdictAbbr(item.status)}
        </strong>
        <span>
          {active && <i className={styles.statusDot} aria-hidden="true" />}
          {showScore || active ? `${verdictAbbr(item.status)} | ${item.language}` : item.language}
        </span>
      </div>
      <div className={styles.submissionMain}>
        <span className={styles.submissionUser}>{username}</span>
        <time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time>
        <code className={styles.submissionId} title={item.id}>#{item.id.slice(0, 8)}</code>
      </div>
      <div className={styles.submissionLinks}>
        <Link className={styles.rowLink} to={detailsPath} aria-label={`Xem bài nộp ${item.id.slice(0, 8)}, ${statusLabel}`}>
          xem
        </Link>
        <span aria-hidden="true">·</span>
        <Link className={styles.sourceLink} to={`${detailsPath}#source-heading`}>
          mã nguồn
        </Link>
      </div>
      <div className={styles.submissionMetrics}>
        <strong>{formatExecutionTime(item.executionTimeMs)}</strong>
        <span>{formatMemory(item.memoryUsedKb)}</span>
      </div>
    </li>
  )
}

function ProblemSubmissionsContent({ code }: { code: string }) {
  const { request, user } = useAuth()
  const username = user?.username ?? user?.full_name ?? user?.email ?? 'Tôi'
  const [data, setData] = useState<ProblemSubmissionPage | null>(null)
  const dataRef = useRef<ProblemSubmissionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [draftStatus, setDraftStatus] = useState('')
  const [draftLanguage, setDraftLanguage] = useState('')
  const [filters, setFilters] = useState<Pick<ProblemSubmissionFilters, 'status' | 'language'>>({})

  const load = useCallback(
    () => getMyProblemSubmissions(request, code, { ...filters, page, pageSize }),
    [code, filters, page, pageSize, request],
  )

  useEffect(() => {
    let active = true
    let timer: number | undefined
    let inFlight = false

    const schedule = () => {
      if (active) timer = window.setTimeout(() => void fetchPage(), POLL_INTERVAL_MS)
    }

    const fetchPage = async () => {
      if (!active || inFlight) return
      inFlight = true
      if (!dataRef.current) setLoading(true)
      try {
        const result = await load()
        if (!active) return
        dataRef.current = result
        setData(result)
        setError('')
        setLoading(false)
        if (result.items.some(isActive)) schedule()
      } catch (requestError) {
        if (!active) return
        setLoading(false)
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải bài nộp do lỗi kết nối. Vui lòng thử lại.',
        )
        if (dataRef.current?.items.some(isActive)) {
          timer = window.setTimeout(() => void fetchPage(), 4000)
        }
      } finally {
        inFlight = false
      }
    }

    void fetchPage()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [load, retryKey])

  const pagination = useMemo(() => ({
    currentPage: page,
    pageSize,
    totalItems: data?.total ?? 0,
    pageSizes: PAGE_SIZES,
    label: 'bài nộp của tôi',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }), [data?.total, page, pageSize])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters({
      ...(draftStatus ? { status: draftStatus } : {}),
      ...(draftLanguage ? { language: draftLanguage } : {}),
    })
    setPage(1)
  }

  function resetFilters() {
    setDraftStatus('')
    setDraftLanguage('')
    setFilters({})
    setPage(1)
  }

  const hasFilters = Boolean(filters.status || filters.language)
  const stats = data?.statistics
  const verdictDistribution = getSubmissionVerdictDistribution(
    stats?.verdictCounts ?? {},
    stats?.total ?? 0,
  )

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.layout}>
        <div className={styles.content}>
          <section className={styles.listColumn} aria-labelledby="submissions-title">
            <div className={styles.panelHeading}>
              <h2 id="submissions-title">Danh sách bài nộp</h2>
              <span>{data?.total ?? 0} bài</span>
            </div>
            {data && (
              <div className={styles.progressSummary} role="status" aria-live="polite">
                <span>Điểm tích lũy hiện tại</span>
                <strong>{data.problem.cumulativeScore} / {data.problem.totalTestCases}</strong>
              </div>
            )}

            <form className={styles.filters} onSubmit={applyFilters}>
              <label>
                <span>Kết quả</span>
                <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Ngôn ngữ</span>
                <select value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value)}>
                  <option value="">Tất cả ngôn ngữ</option>
                  {(data?.statistics.languages ?? []).map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </label>
              <div className={styles.filterActions}>
                <button type="submit" className={styles.applyButton}>Áp dụng</button>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={resetFilters}
                  disabled={!hasFilters && !draftStatus && !draftLanguage}
                >
                  Đặt lại
                </button>
              </div>
            </form>

            <div className={styles.listCard}>
              {loading && !data ? (
                <div className={styles.state} role="status" aria-live="polite" aria-busy="true">
                  <span className={styles.spinner} aria-hidden="true" />
                  Đang tải bài nộp...
                </div>
              ) : error && !data ? (
                <div className={styles.state} role="alert">
                  <strong>Chưa thể tải bài nộp</strong>
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Thử lại</button>
                </div>
              ) : data && data.items.length === 0 ? (
                <div className={styles.state}>
                  <strong>{hasFilters ? 'Không tìm thấy bài nộp phù hợp' : 'Bạn chưa có bài nộp nào'}</strong>
                  <p>{hasFilters ? 'Thử thay đổi bộ lọc hoặc đặt lại để xem toàn bộ.' : 'Gửi bài giải để bắt đầu theo dõi kết quả tại đây.'}</p>
                  {!hasFilters && <Link to={`/problems/${encodeURIComponent(code)}/submit`}>Gửi bài giải đầu tiên</Link>}
                </div>
              ) : data ? (
                <>
                  {error && (
                    <p className={styles.refreshError} role="status">
                      {error} <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Thử cập nhật</button>
                    </p>
                  )}
                  <ul className={styles.submissionList}>
                    {data.items.map((item) => <SubmissionCard key={item.id} item={item} username={username} />)}
                  </ul>
                  <div className={styles.paginationBottom}>
                    <SubmissionPagination {...pagination} />
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <aside className={styles.sidebar} aria-label="Thống kê bài nộp">
            <section className={styles.statsCard} aria-labelledby="stats-title">
              <div className={styles.panelHeading}>
                <h2 id="stats-title">THỐNG KÊ KẾT QUẢ CHẤM</h2>
              </div>
              <div className={styles.statsBody} aria-busy={loading}>
                <p className={styles.statsSubtitle}></p>
                <div
                  className={styles.donutChart}
                  role="img"
                  aria-label={`Phân bố ${stats?.total ?? 0} bài nộp theo kết quả chấm`}
                >
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle className={styles.donutTrack} cx="50" cy="50" r="40" pathLength="100" />
                    {verdictDistribution.map((item, index) => {
                      const offset = verdictDistribution
                        .slice(0, index)
                        .reduce((sum, segment) => sum + segment.percentage, 0)
                      return (
                        <circle
                          key={item.status}
                          cx="50"
                          cy="50"
                          r="40"
                          pathLength="100"
                          stroke={item.color}
                          strokeDasharray={`${item.percentage} ${100 - item.percentage}`}
                          strokeDashoffset={-offset}
                        />
                      )
                    })}
                  </svg>
                  <div className={styles.donutCenter}>
                    <strong>{stats?.total ?? 0}</strong>
                    <span>bài nộp</span>
                  </div>
                </div>
                <dl className={styles.statsSummary}>
                  <div><dt>Tổng</dt><dd>{stats?.total ?? 0}</dd></div>
                  <div><dt>AC</dt><dd>{stats?.accepted ?? 0}</dd></div>
                  <div><dt>Tỷ lệ AC</dt><dd>{(stats?.acceptanceRate ?? 0).toFixed(1)}%</dd></div>
                </dl>
                {verdictDistribution.length > 0 ? (
                  <ul className={styles.verdictLegend} aria-label="Chú giải kết quả chấm">
                    {verdictDistribution.map((item) => (
                      <li key={item.status}>
                        <span className={styles.verdictName}>
                          <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                          <b>{item.abbr}</b>
                          <span>{item.label}</span>
                        </span>
                        <span className={styles.verdictValue}>
                          {item.count} · {item.percentage.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.chartEmpty}>
                    {loading && !stats ? 'Đang tải thống kê...' : 'Chưa có dữ liệu thống kê.'}
                  </p>
                )}
              </div>
            </section>
            <section className={styles.tipCard}>
              <strong>Thông tin bài nộp</strong>
              <p>Chọn một bài nộp để xem chi tiết kết quả chấm, mã nguồn và trạng thái từng test.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function MyProblemSubmissionsPage() {
  const { code = '' } = useParams()
  return <ProblemSubmissionsContent key={code} code={code} />
}

export default MyProblemSubmissionsPage
