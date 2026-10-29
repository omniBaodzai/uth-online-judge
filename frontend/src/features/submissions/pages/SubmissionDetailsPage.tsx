import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { useBreadcrumbProblemCode } from '../../../components/navigation/useBreadcrumbProblemCode'
import type { SubmissionDetails } from '../../problems/submit/submission-service'
import { getSubmissionDetails } from '../../problems/submit/submission-service'
import { formatMemoryMiB } from '../submission-metrics'
import styles from './SubmissionDetailsPage.module.css'

const ReadOnlyCode = lazy(() => import('../components/ReadOnlyCode'))

const TERMINAL_STATUSES = new Set([
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'INTERNAL_ERROR',
])

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ',
  QUEUED: 'Đã xếp hàng',
  RUNNING: 'Đang chấm',
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
  RUNTIME_ERROR: 'Runtime Error',
  COMPILATION_ERROR: 'Compilation Error',
  INTERNAL_ERROR: 'Lỗi hệ thống',
}

const STATUS_CLASSES: Record<string, string> = {
  ACCEPTED: styles.accepted,
  WRONG_ANSWER: styles.wrongAnswer,
  TIME_LIMIT_EXCEEDED: styles.timeLimit,
  MEMORY_LIMIT_EXCEEDED: styles.memoryLimit,
  RUNTIME_ERROR: styles.runtimeError,
  COMPILATION_ERROR: styles.compilationError,
  INTERNAL_ERROR: styles.internalError,
  RUNNING: styles.running,
  QUEUED: styles.pending,
  PENDING: styles.pending,
}

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}

function statusLabel(status: string | null): string {
  return status ? (STATUS_LABELS[status] ?? status.replaceAll('_', ' ')) : 'Đang chờ'
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatTime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`
}

function formatMemory(value: number | null): string {
  return formatMemoryMiB(value, 2)
}

function SubmissionDetailsContent() {
  const { submissionId = '' } = useParams()
  const { request } = useAuth()
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<ApiError | null>(null)
  const [temporaryError, setTemporaryError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [copyMessage, setCopyMessage] = useState('')
  const [sourceExpanded, setSourceExpanded] = useState(true)
  const uiCommitStartedAt = useRef<number | null>(null)
  const lastRequestDurationMs = useRef<number | null>(null)
  useBreadcrumbProblemCode(submission?.problemCode)

  const loadSubmission = useCallback(
    () => getSubmissionDetails(request, submissionId),
    [request, submissionId],
  )

  useEffect(() => {
    let active = true
    let timer: number | undefined
    let inFlight = false
    const schedule = (delay: number) => {
      if (active) timer = window.setTimeout(() => void load(), delay)
    }

    const load = async () => {
      if (!active || inFlight) return
      inFlight = true
      const requestStartedAt = performance.now()
      try {
        const result = await loadSubmission()
        if (!active) return
        lastRequestDurationMs.current = Math.round(performance.now() - requestStartedAt)
        uiCommitStartedAt.current = performance.now()
        setSubmission(result)
        setRequestError(null)
        setTemporaryError('')
        setLoading(false)
        if (!isTerminal(result.status)) schedule(1800)
      } catch (error) {
        if (!active) return
        setLoading(false)
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          setRequestError(error)
          return
        }
        setTemporaryError('Không thể cập nhật trạng thái do lỗi kết nối. Đang thử lại sau ít giây.')
        schedule(4000)
      } finally {
        inFlight = false
      }
    }

    void load()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [loadSubmission, retryKey])

  useEffect(() => {
    if (!import.meta.env.DEV || uiCommitStartedAt.current === null) return
    console.debug(
      `[submission-details] apiMs=${lastRequestDurationMs.current ?? 'unknown'} responseToUiMs=${Math.round(performance.now() - uiCommitStartedAt.current)}`,
    )
    uiCommitStartedAt.current = null
  }, [submission])

  const completedTests = useMemo(
    () => submission?.testResults.filter((test) => test.status !== null).length ?? 0,
    [submission],
  )
  const snapshotMaxPoints = useMemo(
    () => submission?.testResults.reduce((total, test) => total + test.maxPoints, 0) ?? 0,
    [submission],
  )
  const monacoLanguage = useMemo(() => {
    const language = submission?.language.toLowerCase() ?? ''
    if (language.startsWith('c++') || language.startsWith('c ')) return 'cpp'
    if (language.startsWith('java')) return 'java'
    if (language.startsWith('python')) return 'python'
    if (language.startsWith('javascript')) return 'javascript'
    return 'plaintext'
  }, [submission?.language])

  async function copySource() {
    if (!submission) return
    try {
      await navigator.clipboard.writeText(submission.sourceCode)
      setCopyMessage('Đã sao chép mã nguồn.')
    } catch {
      setCopyMessage('Không thể sao chép. Hãy chọn và sao chép mã trong khung code.')
    }
    window.setTimeout(() => setCopyMessage(''), 3500)
  }

  function retry() {
    setRequestError(null)
    setTemporaryError('')
    if (!submission) setLoading(true)
    setRetryKey((value) => value + 1)
  }

  if (requestError) {
    const isUnauthorized = requestError.status === 401 || requestError.status === 403
    const isMissing = requestError.status === 404
    return (
      <main className={styles.main} id="main-content">
        <section className={styles.stateCard} role="alert">
          <h1>{isUnauthorized ? 'Cần đăng nhập lại' : isMissing ? 'Không tìm thấy bài nộp' : 'Không thể tải bài nộp'}</h1>
          <p>
            {isUnauthorized
              ? 'Phiên đăng nhập không còn hiệu lực hoặc bạn không có quyền xem bài nộp này.'
              : isMissing
                ? 'Bài nộp không tồn tại hoặc bạn không có quyền truy cập.'
                : 'Đã xảy ra lỗi khi tải dữ liệu bài nộp.'}
          </p>
          {isUnauthorized ? (
            <Link className={styles.primaryLink} to={`/login?returnTo=${encodeURIComponent(`/submissions/${submissionId}`)}`}>
              Đăng nhập
            </Link>
          ) : (
            <button type="button" className={styles.secondaryButton} onClick={retry}>Thử lại</button>
          )}
          <Link className={styles.backLink} to="/submissions">Quay lại danh sách bài nộp</Link>
        </section>
      </main>
    )
  }

  if (loading && !submission) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.loading} role="status" aria-live="polite">Đang tải thông tin bài nộp…</div>
      </main>
    )
  }

  if (!submission) {
    return (
      <main className={styles.main} id="main-content">
        <section className={styles.stateCard} role="alert">
          <h1>Chưa thể tải bài nộp</h1>
          <p>{temporaryError || 'Vui lòng kiểm tra kết nối rồi thử lại.'}</p>
          <button type="button" className={styles.secondaryButton} onClick={retry}>Thử lại</button>
        </section>
      </main>
    )
  }

  const active = !isTerminal(submission.status)
  const liveScore = active
    ? submission.testResults.reduce((total, test) => total + test.pointsAwarded, 0)
    : submission.score
  const scoringConfigured = submission.scoringEnabled

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>CHI TIẾT BÀI NỘP</p>
            <h1>Bài nộp của {submission.username || 'bạn'}</h1>
            <p className={styles.problemCode}>
              Cho bài <Link to={`/problems/${encodeURIComponent(submission.problemCode)}`}>{submission.problemCode} — {submission.problemTitle}</Link>
            </p>
            <div className={styles.submissionMeta}>
              <span>{formatDate(submission.submittedAt)}</span>
              <span>{submission.language}</span>
              <code>{submission.id}</code>
            </div>
          </div>
          <span className={`${styles.verdictBadge} ${STATUS_CLASSES[submission.status] ?? styles.internalError}`} role="status" aria-live="polite">
            {active && <span className={styles.statusDot} aria-hidden="true" />}
            {statusLabel(submission.status)}
          </span>
        </header>

        {temporaryError && (
          <div className={styles.networkNotice} role="status">
            <span>{temporaryError}</span>
            <button type="button" onClick={retry}>Thử cập nhật ngay</button>
          </div>
        )}

        <section className={styles.resultSummary} aria-label="Kết quả chấm">
          <div className={styles.scoreCard}>
            <span className={styles.metricLabel}>Điểm lần nộp</span>
            <strong>{scoringConfigured ? <>{liveScore} <span>/ {submission.maxScore}</span></> : 'Không áp dụng'}</strong>
            {scoringConfigured && !active && snapshotMaxPoints !== submission.maxScore && (
              <small>Snapshot test: {snapshotMaxPoints.toFixed(2)} điểm</small>
            )}
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>Điểm tích lũy</span>
            <strong>{submission.cumulativeScore} / {submission.cumulativeMaxScore}</strong>
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>Test đạt</span>
            <strong>{submission.testResults.filter((test) => test.status === 'ACCEPTED').length} / {submission.testResults.length}</strong>
            {active && <small>{completedTests} test đã hoàn tất</small>}
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>Thời gian chạy</span>
            <strong>{formatTime(submission.executionTimeMs)}</strong>
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>Bộ nhớ cao nhất</span>
            <strong>{formatMemory(submission.memoryUsedKb)}</strong>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="test-results-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="test-results-heading">Kết quả từng test</h2>
              <p>{completedTests} / {submission.testResults.length} test đã chấm · Không hiển thị dữ liệu test.</p>
            </div>
            {active && <span className={styles.liveLabel}>Đang cập nhật tự động</span>}
          </div>
          {submission.testResults.length === 0 ? (
            <p className={styles.emptyState}>
              {active ? 'Đang chờ worker bắt đầu chấm bài…' : 'Bài nộp này không có kết quả test để hiển thị.'}
            </p>
          ) : (
            <div className={styles.tableScroll} role="region" aria-label="Bảng kết quả test case" tabIndex={0}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Kết quả</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Bộ nhớ</th>
                    <th scope="col">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.testResults.map((test) => (
                    <tr key={test.position}>
                      <td className={styles.testNumber}>#{test.position}</td>
                      <td>
                        <span className={`${styles.testVerdict} ${STATUS_CLASSES[test.status ?? 'PENDING'] ?? styles.pending}`}>
                          {statusLabel(test.status)}
                        </span>
                      </td>
                      <td>{formatTime(test.executionTimeMs)}</td>
                      <td>{formatMemory(test.memoryUsedKb)}</td>
                      <td>{scoringConfigured ? `${test.pointsAwarded} / ${test.maxPoints}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${styles.section} ${styles.sourceCard}`} aria-labelledby="source-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="source-heading">Xem mã nguồn</h2>
              <p>Chỉ đọc · {submission.language}</p>
            </div>
            <div className={styles.sourceActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => void copySource()}>
                Sao chép mã nguồn
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-expanded={sourceExpanded}
                aria-controls="submission-source-code"
                onClick={() => setSourceExpanded((expanded) => !expanded)}
              >
                {sourceExpanded ? 'Thu gọn' : 'Mở mã nguồn'}
              </button>
            </div>
          </div>
          {copyMessage && <p className={styles.copyMessage} role="status">{copyMessage}</p>}
          {sourceExpanded && (
            <div id="submission-source-code">
              <Suspense fallback={<div className={styles.codeLoading} role="status">Đang tải trình hiển thị mã nguồn…</div>}>
                <ReadOnlyCode code={submission.sourceCode} language={monacoLanguage} />
              </Suspense>
            </div>
          )}
        </section>

        <div className={styles.footerActions}>
          <Link className={styles.secondaryLink} to={`/problems/${encodeURIComponent(submission.problemCode)}`}>
            Quay lại bài tập
          </Link>
          <Link className={styles.primaryLink} to={`/problems/${encodeURIComponent(submission.problemCode)}/submit`}>
            Nộp lại
          </Link>
        </div>
      </div>
    </main>
  )
}

function SubmissionDetailsPage() {
  const { submissionId = '' } = useParams()
  return <SubmissionDetailsContent key={submissionId} />
}

export default SubmissionDetailsPage
