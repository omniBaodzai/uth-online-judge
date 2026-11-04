import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import {
  getMyProblemSubmissions,
  type ProblemSubmissionFilters,
  type ProblemSubmissionListItem,
  type ProblemSubmissionPage,
} from '../../problems/submit/submission-service'
import SubmissionPagination from '../components/SubmissionPagination'
import {
  getSubmissionVerdictDistribution,
  submissionVerdictTranslationKeys,
  submissionVerdicts,
} from '../data/submission-verdicts'
import { formatMemoryMiB } from '../submission-metrics'
import '../i18n'
import styles from './MyProblemSubmissionsPage.module.css'

const PAGE_SIZES = [10, 20, 50]
const POLL_INTERVAL_MS = 2200

const STATUS_OPTIONS = [
  ['PENDING', 'verdictPending'],
  ['QUEUED', 'verdictQueued'],
  ['RUNNING', 'verdictRunning'],
  ['ACCEPTED', 'verdictAccepted'],
  ['WRONG_ANSWER', 'verdictWrongAnswer'],
  ['TIME_LIMIT_EXCEEDED', 'verdictTimeLimit'],
  ['MEMORY_LIMIT_EXCEEDED', 'verdictMemoryLimit'],
  ['RUNTIME_ERROR', 'verdictRuntime'],
  ['COMPILATION_ERROR', 'verdictCompile'],
  ['INTERNAL_ERROR', 'verdictInternal'],
] as const

function isActive(item: ProblemSubmissionListItem): boolean {
  return ['PENDING', 'QUEUED', 'RUNNING'].includes(item.status)
}

function formatDate(value: string, locale: string, unknownDate: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? unknownDate
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function formatExecutionTime(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 1000)} s`
}

function formatMemory(value: number | null, locale: string): string {
  return formatMemoryMiB(value, 1, locale)
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
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const numberFormat = new Intl.NumberFormat(locale)
  const detailsPath = `/submissions/${encodeURIComponent(item.id)}?from=my-submissions`
  const showScore = item.scoringEnabled && item.score !== null && item.maxScore !== null
  const active = isActive(item)
  const statusKey = submissionVerdictTranslationKeys[item.status]
  const statusLabel = statusKey ? t(statusKey) : item.status

  return (
    <li className={styles.submission}>
      <div
        className={`${styles.verdictBlock} ${submissionStatusClass(item.status)}`}
        role="status"
        aria-label={showScore
          ? t('submissionsScoreStatusLabel', {
              status: statusLabel,
              score: numberFormat.format(item.score!),
              maxScore: numberFormat.format(item.maxScore!),
            })
          : statusLabel}
      >
        <strong>
          {showScore ? `${numberFormat.format(item.score!)} / ${numberFormat.format(item.maxScore!)}` : active ? statusLabel : verdictAbbr(item.status)}
        </strong>
        <span>
          {active && <i className={styles.statusDot} aria-hidden="true" />}
          {showScore || active ? `${verdictAbbr(item.status)} | ${item.language}` : item.language}
        </span>
      </div>
      <div className={styles.submissionMain}>
        <span className={styles.submissionUser}>{username}</span>
        <time dateTime={item.submittedAt}>{formatDate(item.submittedAt, locale, t('submissionsUnknownDate'))}</time>
        <code className={styles.submissionId} title={item.id}>#{item.id.slice(0, 8)}</code>
      </div>
      <div className={styles.submissionLinks}>
        <Link className={styles.rowLink} to={detailsPath} aria-label={`${t('submissionsViewItem')} #${item.id.slice(0, 8)}, ${statusLabel}`}>
          {t('submissionsViewItem')}
        </Link>
        <span aria-hidden="true">·</span>
        <Link className={styles.sourceLink} to={`${detailsPath}#source-heading`}>
          {t('submissionsViewSource')}
        </Link>
      </div>
      <div className={styles.submissionMetrics}>
        <strong>{formatExecutionTime(item.executionTimeMs, locale)}</strong>
        <span>{formatMemory(item.memoryUsedKb, locale)}</span>
      </div>
    </li>
  )
}

function ProblemSubmissionsContent({ code }: { code: string }) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const numberFormat = new Intl.NumberFormat(locale)
  const { request, user } = useAuth()
  const username = user?.username ?? user?.full_name ?? user?.email ?? t('submissionsYou')
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
            : t('submissionsLoadNetworkError'),
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
  }, [load, retryKey, t])

  const pagination = useMemo(() => ({
    currentPage: page,
    pageSize,
    totalItems: data?.total ?? 0,
    pageSizes: PAGE_SIZES,
    label: t('mySubmissionItems', { ns: 'common' }),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }), [data?.total, page, pageSize, t])

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
              <h2 id="submissions-title">{t('submissionsListTitle')}</h2>
              <span>{t('submissionsCount', { count: numberFormat.format(data?.total ?? 0) })}</span>
            </div>
            {data && (
              <div className={styles.progressSummary} role="status" aria-live="polite">
                <span>{t('submissionsCurrentScore')}</span>
                <strong>{numberFormat.format(data.problem.cumulativeScore)} / {numberFormat.format(data.problem.totalTestCases)}</strong>
              </div>
            )}

            <form className={styles.filters} onSubmit={applyFilters}>
              <label>
                <span>{t('results')}</span>
                <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                  <option value="">{t('submissionsAllStatuses')}</option>
                  {STATUS_OPTIONS.map(([value, labelKey]) => <option key={value} value={value}>{t(labelKey)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('language', { ns: 'common' })}</span>
                <select value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value)}>
                  <option value="">{t('submissionsAllLanguages')}</option>
                  {(data?.statistics.languages ?? []).map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </label>
              <div className={styles.filterActions}>
                <button type="submit" className={styles.applyButton}>{t('submissionsApplyFilters')}</button>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={resetFilters}
                  disabled={!hasFilters && !draftStatus && !draftLanguage}
                >
                  {t('resetFilters')}
                </button>
              </div>
            </form>

            <div className={styles.listCard}>
              {loading && !data ? (
                <div className={styles.state} role="status" aria-live="polite" aria-busy="true">
                  <span className={styles.spinner} aria-hidden="true" />
                  {t('submissionsLoading')}
                </div>
              ) : error && !data ? (
                <div className={styles.state} role="alert">
                  <strong>{t('submissionsCannotLoad')}</strong>
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetryKey((value) => value + 1)}>{t('retry')}</button>
                </div>
              ) : data && data.items.length === 0 ? (
                <div className={styles.state}>
                  <strong>{hasFilters ? t('submissionsEmptyFilteredTitle') : t('submissionsEmptyTitle')}</strong>
                  <p>{hasFilters ? t('submissionsEmptyFilteredHint') : t('submissionsEmptyHint')}</p>
                  {!hasFilters && <Link to={`/problems/${encodeURIComponent(code)}/submit`}>{t('submissionsSubmitFirst')}</Link>}
                </div>
              ) : data ? (
                <>
                  {data.items.length > 0 ? (
                    <div className={styles.paginationTop}>
                      <SubmissionPagination {...pagination} showPageSize={false} />
                    </div>
                  ) : null}
                  {error && (
                    <p className={styles.refreshError} role="status">
                      {error} <button type="button" onClick={() => setRetryKey((value) => value + 1)}>{t('submissionsRetryUpdate')}</button>
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

          <aside className={styles.sidebar} aria-label={t('submissionsStatsLabel')}>
            <section className={styles.statsCard} aria-labelledby="stats-title">
              <div className={styles.panelHeading}>
                <h2 id="stats-title">{t('submissionsStatsHeading')}</h2>
              </div>
              <div className={styles.statsBody} aria-busy={loading}>
                <p className={styles.statsSubtitle}></p>
                <div
                  className={styles.donutChart}
                  role="img"
                  aria-label={t('submissionsVerdictDistribution', { count: numberFormat.format(stats?.total ?? 0) })}
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
                    <strong>{numberFormat.format(stats?.total ?? 0)}</strong>
                    <span>{t('submissionsCountUnit')}</span>
                  </div>
                </div>
                <dl className={styles.statsSummary}>
                  <div><dt>{t('submissionsTotal')}</dt><dd>{numberFormat.format(stats?.total ?? 0)}</dd></div>
                  <div><dt>AC</dt><dd>{numberFormat.format(stats?.accepted ?? 0)}</dd></div>
                  <div><dt>{t('submissionsAcceptedRate')}</dt><dd>{new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats?.acceptanceRate ?? 0)}%</dd></div>
                </dl>
                {verdictDistribution.length > 0 ? (
                  <ul className={styles.verdictLegend} aria-label={t('submissionsVerdictLegend')}>
                    {verdictDistribution.map((item) => (
                      <li key={item.status}>
                        <span className={styles.verdictName}>
                          <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                          <b>{item.abbr}</b>
                          <span>{submissionVerdictTranslationKeys[item.status] ? t(submissionVerdictTranslationKeys[item.status]) : item.label}</span>
                        </span>
                        <span className={styles.verdictValue}>
                          {numberFormat.format(item.count)} · {new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(item.percentage)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.chartEmpty}>
                    {loading && !stats ? t('submissionsLoadingStats') : t('submissionsNoStats')}
                  </p>
                )}
              </div>
            </section>
            <section className={styles.tipCard}>
              <strong>{t('submissionsInfoTitle')}</strong>
              <p>{t('submissionsInfoDescription')}</p>
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
