import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError, request as publicRequest } from '../../auth/api'
import { getBestSubmissions, type BestSubmissionPage as BestSubmissionsData } from '../../problems/submit/submission-service'
import FilterDropdown from '../../problems/components/FilterDropdown'
import SubmissionPagination from '../components/SubmissionPagination'
import SubmissionStatsChart from '../components/SubmissionStatsChart'
import SubmissionTable from '../components/SubmissionTable'
import { submissionPageSizes } from '../data'
import '../i18n'
import styles from './SubmissionsPage.module.css'
import pageStyles from './BestSubmissionsPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

function BestSubmissionsPage() {
  const { code = '' } = useParams<{ code: string }>()
  return <BestSubmissionsContent key={code.toUpperCase()} code={code} />
}

function BestSubmissionsContent({ code }: { code: string }) {
  const { t } = useTranslation('pages')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [language, setLanguage] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(submissionPageSizes[0])
  const [data, setData] = useState<BestSubmissionsData | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const requestKey = JSON.stringify([code, language, page, pageSize, debouncedQuery, retryKey])
  const isLoading = settled?.key !== requestKey
  const error = settled?.key === requestKey ? settled.error : ''

  useEffect(() => {
    const controller = new AbortController()
    getBestSubmissions(
      publicRequest,
      code,
      { page, pageSize, q: debouncedQuery, language: language || undefined },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        if (!result.languages.includes(language)) {
          const defaultLanguage = result.languages[0] ?? ''
          if (defaultLanguage !== language) {
            setLanguage(defaultLanguage)
            setPage(1)
            return
          }
        }
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.ceil(result.total / pageSize))
          return
        }
        setSettled({ key: requestKey, error: '' })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error: requestError instanceof ApiError
            ? requestError.message
            : t('submissionsBestLoadError'),
        })
      })
    return () => controller.abort()
  }, [code, language, page, pageSize, debouncedQuery, requestKey, retryKey, t])

  const paginationProps = useMemo(() => ({
    currentPage: page,
    pageSize,
    totalItems: data?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: t('bestSolutions', { ns: 'common' }),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }), [data?.total, page, pageSize, t])
  const languageOptions = useMemo(
    () => (data?.languages ?? []).map((value) => ({ value, label: value })),
    [data?.languages],
  )

  const hasFilters = Boolean(debouncedQuery)
  const statistics = data?.statistics
  const title = data?.problem.title ?? code
  const problemCode = data?.problem.code ?? code
  const emptyTitle = data?.languages.length === 0
    ? t('submissionsNoAcceptedTitle')
    : hasFilters
      ? t('submissionsNoCoderMatch')
      : t('submissionsLanguageNoBest')
  const emptyDescription = data?.languages.length === 0
    ? t('submissionsNoAcceptedHint')
    : hasFilters
      ? t('submissionsTryAnotherCoder')
      : t('submissionsChooseLanguage')

  function resetSearch() {
    setQuery('')
    setDebouncedQuery('')
    setPage(1)
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>
            {t('submissionsBestForProblem')}{' '}
            <Link
              to={`/problems/${encodeURIComponent(problemCode)}`}
              className={`${styles.problemLink} ${pageStyles.problemLink}`}
            >
              {title}
            </Link>
          </h1>
        </header>

        <form
          className={`${styles.filters} ${pageStyles.filters}`}
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label={t('submissionsSearchCoderLabel')}
              placeholder={t('submissionsSearchCoderPlaceholder')}
              maxLength={100}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <FilterDropdown
            label={t('language', { ns: 'common' })}
            options={languageOptions}
            selected={language ? [language] : []}
            onChange={(selected) => {
              setLanguage(selected[0] ?? '')
              setPage(1)
            }}
          />
          <button type="button" className={styles.reset} onClick={resetSearch} disabled={!query}>
            {t('resetFilters')}
          </button>
        </form>

        <div className={styles.card}>
          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} showPageSize={false} />
          </div>
          {error && (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)}>{t('retry')}</button>
            </div>
          )}
          <SubmissionTable
            items={data?.items ?? []}
            isLoading={isLoading}
            hasFilters={hasFilters}
            hideProblem
            showRank
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </div>

        <aside className={styles.right}>
          <SubmissionStatsChart
            total={statistics?.total ?? 0}
            accepted={statistics?.accepted ?? 0}
            verdictCounts={statistics?.verdictCounts ?? {}}
            subtitle={language
              ? t(debouncedQuery ? 'submissionsSearchByCoder' : 'submissionsSearchByLanguage', {
                  language,
                  query: debouncedQuery,
                })
              : undefined}
          />
        </aside>
      </div>
    </main>
  )
}

export default BestSubmissionsPage
