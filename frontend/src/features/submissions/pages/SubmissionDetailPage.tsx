import { useEffect, useRef, useState } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import { getSubmission, isJudgingFinished, languageNameById, type SubmissionResult } from '../api'
import styles from './SubmissionDetailPage.module.css'

const POLL_INTERVAL_MS = 2000

const statusLabels: Record<string, string> = {
  PENDING: 'Đang chờ chấm',
  JUDGING: 'Đang chấm',
  AC: 'Chính xác',
  WA: 'Sai kết quả',
  TLE: 'Quá thời gian',
  MLE: 'Quá bộ nhớ',
  RE: 'Lỗi khi chạy',
  CE: 'Lỗi biên dịch',
}

function sourceCodeBlock(submission: SubmissionResult) {
  if (!submission.sourceCode) return null
  return (
    <>
      <h2>Mã nguồn ({languageNameById[submission.languageId] ?? `#${submission.languageId}`})</h2>
      <pre className={styles.output}>{submission.sourceCode}</pre>
    </>
  )
}

function SubmissionDetailPage({ submissionId }: { submissionId: string }) {
  const { request, isAuthenticated, isLoading } = useAuth()
  const requestRef = useRef(request)
  const [submission, setSubmission] = useState<SubmissionResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    let cancelled = false
    let timer: number | undefined

    async function load() {
      try {
        const result = await getSubmission(requestRef.current, submissionId)
        if (cancelled) return
        setSubmission(result)
        setError('')
        if (!isJudgingFinished(result.status)) timer = window.setTimeout(load, POLL_INTERVAL_MS)
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Không thể tải bài nộp.')
      }
    }

    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [submissionId, isAuthenticated, isLoading])

  const finished = submission ? isJudgingFinished(submission.status) : false

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav className={styles.breadcrumb}>
          <a href="/submissions">Bảng chấm bài</a> / <span>Bài nộp {submissionId.slice(0, 8)}</span>
        </nav>

        {!isLoading && !isAuthenticated && <p className={styles.error} role="alert">Vui lòng <a href="/login">đăng nhập</a> để xem bài nộp.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!submission && !error && isAuthenticated && <p>Đang tải kết quả...</p>}

        {submission && (
          <section className={styles.card} aria-live="polite">
            <header>
              <h1>Bài {submission.problemCode}</h1>
              <span className={`${styles.badge} ${styles[submission.status]}`}>
                {statusLabels[submission.status] ?? submission.status} ({submission.status})
              </span>
            </header>
            {!finished && <p className={styles.hint}>Hệ thống đang chấm, trang sẽ tự cập nhật mỗi 2 giây...</p>}
            <dl className={styles.stats}>
              <div><dt>Người nộp</dt><dd>{submission.username ?? '—'}</dd></div>
              <div><dt>Điểm</dt><dd>{finished ? submission.score : '—'}</dd></div>
              <div><dt>Test đạt</dt><dd>{finished ? `${submission.passedTests}/${submission.totalTests}` : '—'}</dd></div>
              <div><dt>Thời gian</dt><dd>{finished && submission.executionTime !== null ? `${submission.executionTime.toFixed(3)} s` : '—'}</dd></div>
              <div><dt>Bộ nhớ</dt><dd>{finished && submission.memoryUsed !== null ? `${(submission.memoryUsed / 1024).toFixed(1)} MB` : '—'}</dd></div>
              <div><dt>Thời điểm nộp</dt><dd>{new Date(submission.createdAt).toLocaleString('vi-VN')}</dd></div>
            </dl>
            {submission.compileOutput && (
              <>
                <h2>{submission.status === 'CE' ? 'Thông báo biên dịch' : 'Thông báo lỗi'}</h2>
                <pre className={styles.output}>{submission.compileOutput}</pre>
              </>
            )}
            {sourceCodeBlock(submission)}
            <div className={styles.actions}>
              <a href="/submissions">Xem bảng chấm bài</a>
              <a href={`/problems/${submission.problemCode}`}>Về đề bài</a>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default SubmissionDetailPage
