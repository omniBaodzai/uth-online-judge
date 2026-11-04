import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { useBreadcrumbContestProblem } from '../../../components/navigation/useBreadcrumbContestProblem'
import { useBreadcrumbProblemCode } from '../../../components/navigation/useBreadcrumbProblemCode'
import type { SubmissionDetails } from '../../problems/submit/submission-service'
import { getSubmissionDetails } from '../../problems/submit/submission-service'
import { formatMemoryMiB } from '../submission-metrics'
import { submissionVerdictTranslationKeys } from '../data/submission-verdicts'
import '../i18n'
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

function statusLabel(status: string | null, translate: (key: string) => string): string {
  const key = status ? submissionVerdictTranslationKeys[status] : 'verdictPending'
  return key ? translate(key) : status ?? translate('verdictPending')
}

function formatTime(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return value < 1000
    ? `${new Intl.NumberFormat(locale).format(value)} ms`
    : `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 1000)} s`
}

function formatMemory(value: number | null, locale: string): string {
  return formatMemoryMiB(value, 2, locale)
}

function SubmissionDetailsContent() {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const numberFormat = new Intl.NumberFormat(locale)
  const { submissionId = '' } = useParams()
  const location = useLocation()
  const { request } = useAuth()
  const state = location.state as {
    contestSubmissionOrigin?: {
      contestIdentifier?: unknown
      contestSlug?: unknown
      contestTitle?: unknown
      problemCode?: unknown
      problemTitle?: unknown
    }
  } | null
  const contestOrigin = state?.contestSubmissionOrigin
  const contestIdentifier = typeof contestOrigin?.contestIdentifier === 'string'
    ? contestOrigin.contestIdentifier
    : null
  const contestSlug = typeof contestOrigin?.contestSlug === 'string'
    ? contestOrigin.contestSlug
    : contestIdentifier
  const contestTitle = typeof contestOrigin?.contestTitle === 'string'
    ? contestOrigin.contestTitle
    : null
  const contestProblemCode = typeof contestOrigin?.problemCode === 'string'
    ? contestOrigin.problemCode
    : null
  const contestProblemTitle = typeof contestOrigin?.problemTitle === 'string'
    ? contestOrigin.problemTitle
    : null
  useBreadcrumbContestProblem(
    contestIdentifier ?? undefined,
    contestIdentifier && contestSlug && contestTitle
      ? { slug: contestSlug, title: contestTitle }
      : undefined,
    contestProblemTitle,
  )
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<ApiError | null>(null)
  const [temporaryError, setTemporaryError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [copyMessage, setCopyMessage] = useState<'' | 'copied' | 'copy-failed'>('')
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
        setTemporaryError(t('submissionsNetworkRetry'))
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
  }, [loadSubmission, retryKey, t])

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
      setCopyMessage('copied')
    } catch {
      setCopyMessage('copy-failed')
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
          <h1>{isUnauthorized ? t('submissionsReauthRequired') : isMissing ? t('submissionsNotFound') : t('submissionsLoadError')}</h1>
          <p>
            {isUnauthorized
              ? t('submissionsSessionExpired')
              : isMissing
                ? t('submissionsMissingOrForbidden')
                : t('submissionsDetailLoadFailed')}
          </p>
          {isUnauthorized ? (
            <Link className={styles.primaryLink} to={`/login?returnTo=${encodeURIComponent(`/submissions/${submissionId}`)}`}>
              {t('login', { ns: 'common' })}
            </Link>
          ) : (
            <button type="button" className={styles.secondaryButton} onClick={retry}>{t('retry')}</button>
          )}
          <Link className={styles.backLink} to="/submissions">{t('submissionsBackToList')}</Link>
        </section>
      </main>
    )
  }

  if (loading && !submission) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.loading} role="status" aria-live="polite">{t('submissionsLoadingDetails')}</div>
      </main>
    )
  }

  if (!submission) {
    return (
      <main className={styles.main} id="main-content">
        <section className={styles.stateCard} role="alert">
          <h1>{t('submissionsCannotLoadYet')}</h1>
          <p>{temporaryError || t('submissionsCheckConnection')}</p>
          <button type="button" className={styles.secondaryButton} onClick={retry}>{t('retry')}</button>
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
            
            <h1>{t('submissionsDetailFor', { username: submission.username || t('submissionsYou') })}</h1>
            <p className={styles.problemCode}>
              {t('submissionsDetailProblem')} <Link to={`/problems/${encodeURIComponent(submission.problemCode)}`}>{submission.problemCode} — {submission.problemTitle}</Link>
            </p>
            {contestIdentifier && contestProblemCode && (
              <p className={styles.problemCode}>
                <Link
                  className={styles.backLink}
                  to={`/contests/${encodeURIComponent(contestSlug ?? contestIdentifier)}/problems/${encodeURIComponent(contestProblemCode)}`}
                >
                  {t('submissionsBackToContestProblem')}
                </Link>
              </p>
            )}
            {/* <div className={styles.submissionMeta}>
              <span>{formatDate(submission.submittedAt)}</span>
              <span>{submission.language}</span>
              <code>{submission.id}</code>
            </div> */}
          </div>
          <span className={`${styles.verdictBadge} ${STATUS_CLASSES[submission.status] ?? styles.internalError}`} role="status" aria-live="polite">
            {active && <span className={styles.statusDot} aria-hidden="true" />}
            {statusLabel(submission.status, t)}
          </span>
        </header>

        {temporaryError && (
          <div className={styles.networkNotice} role="status">
            <span>{temporaryError}</span>
            <button type="button" onClick={retry}>{t('submissionsRetryRefresh')}</button>
          </div>
        )}

        <section className={styles.resultSummary} aria-label={t('submissionsResultSummary')}>
          <div className={styles.scoreCard}>
            <span className={styles.metricLabel}>{t('submissionsSubmissionScore')}</span>
            <strong>{scoringConfigured ? <>{numberFormat.format(liveScore)} <span>/ {numberFormat.format(submission.maxScore)}</span></> : t('submissionsNotApplicable')}</strong>
            {scoringConfigured && !active && snapshotMaxPoints !== submission.maxScore && (
              <small>{t('submissionsTestSnapshot', { score: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(snapshotMaxPoints) })}</small>
            )}
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>{t('submissionsCumulativeScore')}</span>
            <strong>{numberFormat.format(submission.cumulativeScore)} / {numberFormat.format(submission.cumulativeMaxScore)}</strong>
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>{t('submissionsTestsPassed')}</span>
            <strong>{numberFormat.format(submission.testResults.filter((test) => test.status === 'ACCEPTED').length)} / {numberFormat.format(submission.testResults.length)}</strong>
            {active && <small>{t('submissionsTestsCompleted', { count: numberFormat.format(completedTests) })}</small>}
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>{t('submissionsRuntime')}</span>
            <strong>{formatTime(submission.executionTimeMs, locale)}</strong>
          </div>
          <div className={styles.resultMetric}>
            <span className={styles.metricLabel}>{t('submissionsPeakMemory')}</span>
            <strong>{formatMemory(submission.memoryUsedKb, locale)}</strong>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="test-results-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="test-results-heading">{t('submissionsTestResults')}</h2>
              <p></p>
            </div>
            {active && <span className={styles.liveLabel}>{t('submissionsAutoUpdating')}</span>}
          </div>
          {submission.testResults.length === 0 ? (
            <p className={styles.emptyState}>
              {active ? t('submissionsWaitingForWorker') : t('submissionsNoTestResults')}
            </p>
          ) : (
            <div className={styles.tableScroll} role="region" aria-label={t('submissionsTestCaseTable')} tabIndex={0}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th scope="col">{t('submissionsTest')}</th>
                    <th scope="col">{t('submissionsResult')}</th>
                    <th scope="col">{t('submissionsTime')}</th>
                    <th scope="col">{t('submissionsMemory')}</th>
                    <th scope="col">{t('submissionsPoints')}</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.testResults.map((test) => (
                    <tr key={test.position}>
                      <td className={styles.testNumber}>#{numberFormat.format(test.position)}</td>
                      <td>
                        <span className={`${styles.testVerdict} ${STATUS_CLASSES[test.status ?? 'PENDING'] ?? styles.pending}`}>
                          {statusLabel(test.status, t)}
                        </span>
                      </td>
                      <td>{formatTime(test.executionTimeMs, locale)}</td>
                      <td>{formatMemory(test.memoryUsedKb, locale)}</td>
                      <td>{scoringConfigured ? `${numberFormat.format(test.pointsAwarded)} / ${numberFormat.format(test.maxPoints)}` : '—'}</td>
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
              <h2 id="source-heading">{t('submissionsSourceTitle')}</h2>
          
            </div>
            <div className={styles.sourceActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => void copySource()}>
                {t('submissionsCopySource')}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-expanded={sourceExpanded}
                aria-controls="submission-source-code"
                onClick={() => setSourceExpanded((expanded) => !expanded)}
              >
                {sourceExpanded ? t('submissionsCollapse') : t('submissionsOpenSource')}
              </button>
            </div>
          </div>
          {copyMessage && (
            <p className={styles.copyMessage} role="status">
              {t(copyMessage === 'copied' ? 'submissionsCopySucceeded' : 'submissionsCopyFailed')}
            </p>
          )}
          {sourceExpanded && (
            <div id="submission-source-code">
              <Suspense fallback={<div className={styles.codeLoading} role="status">{t('submissionsLoadingSource')}</div>}>
                <ReadOnlyCode code={submission.sourceCode} language={monacoLanguage} />
              </Suspense>
            </div>
          )}
        </section>

        <div className={styles.footerActions}>
          <Link className={styles.secondaryLink} to={`/problems/${encodeURIComponent(submission.problemCode)}`}>
            {t('submissionsBackToProblem')}
          </Link>
          <Link className={styles.primaryLink} to={`/problems/${encodeURIComponent(submission.problemCode)}/submit`}>
            {t('submissionsResubmit')}
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
