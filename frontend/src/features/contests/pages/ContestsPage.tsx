import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import {
  getStudentContestPage,
  type StudentContestListItem,
  type StudentContestPage,
  type StudentContestSortField,
  type StudentContestTimeStatus,
} from '../student-contests.api'
import styles from './ContestsPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]
const SEARCH_DEBOUNCE_MS = 300

type ContestSectionConfig = {
  titleKey: 'ongoingContests' | 'upcomingContests' | 'endedContests'
  status: StudentContestTimeStatus
  actionKey: 'joinContestAction' | 'registerContestAction' | 'viewContestDetails'
}

type ContestSortOption = {
  value: string
  labelKey: string
  sort: StudentContestSortField
  order: 'asc' | 'desc'
}

const sections: ContestSectionConfig[] = [
  {
    titleKey: 'ongoingContests',
    status: 'ONGOING',
    actionKey: 'joinContestAction',
  },
  {
    titleKey: 'upcomingContests',
    status: 'UPCOMING',
    actionKey: 'registerContestAction',
  },
  {
    titleKey: 'endedContests',
    status: 'ENDED',
    actionKey: 'viewContestDetails',
  },
]

const sortOptions: ContestSortOption[] = [
  { value: 'startsAt:asc', labelKey: 'sortStartSoonest', sort: 'startsAt', order: 'asc' },
  { value: 'startsAt:desc', labelKey: 'sortStartLatest', sort: 'startsAt', order: 'desc' },
  { value: 'endsAt:asc', labelKey: 'sortEndSoonest', sort: 'endsAt', order: 'asc' },
  { value: 'endsAt:desc', labelKey: 'sortEndLatest', sort: 'endsAt', order: 'desc' },
  { value: 'title:asc', labelKey: 'sortTitleAsc', sort: 'title', order: 'asc' },
  { value: 'title:desc', labelKey: 'sortTitleDesc', sort: 'title', order: 'desc' },
  { value: 'participantCount:desc', labelKey: 'sortMostParticipants', sort: 'participantCount', order: 'desc' },
  { value: 'participantCount:asc', labelKey: 'sortFewestParticipants', sort: 'participantCount', order: 'asc' },
]

function formatContestDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function getContestDurationMinutes(contest: StudentContestListItem): number {
  return Math.max(0, Math.round(
    (new Date(contest.endsAt).getTime() - new Date(contest.startsAt).getTime()) / 60_000,
  ))
}

function ContestSection({ config }: { config: ContestSectionConfig }) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const title = t(config.titleKey)
  const {
    accessToken,
    user,
    request: authRequest,
    isLoading: isAuthLoading,
  } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sortValue, setSortValue] = useState(config.status === 'ENDED' ? 'startsAt:desc' : 'startsAt:asc')
  const [result, setResult] = useState<StudentContestPage | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const selectedSort = sortOptions.find((option) => option.value === sortValue) ?? sortOptions[0]
  const requestKey = JSON.stringify([
    config.status,
    debouncedQuery,
    page,
    pageSize,
    selectedSort.sort,
    selectedSort.order,
    user?.id ?? null,
    retryKey,
  ])
  const isLoading = isAuthLoading || settled?.key !== requestKey
  const error = settled?.key === requestKey ? settled.error : ''
  const visibleResult = settled?.key === requestKey ? result : null

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (isAuthLoading) return
    const controller = new AbortController()
    getStudentContestPage({
      page,
      pageSize,
      search: debouncedQuery,
      timeStatus: config.status,
      sort: selectedSort.sort,
      order: selectedSort.order,
    }, accessToken ? authRequest : undefined, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, Math.ceil(response.total / pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(response)
        setSettled({ key: requestKey, error: '' })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error: requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải danh sách cuộc thi. Vui lòng thử lại.',
        })
      })
    return () => controller.abort()
  }, [
    config.status,
    accessToken,
    authRequest,
    debouncedQuery,
    isAuthLoading,
    page,
    pageSize,
    requestKey,
    retryKey,
    selectedSort.order,
    selectedSort.sort,
  ])

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: visibleResult?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: title,
    summaryLabel: t('contestItems', { ns: 'common' }),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
  const contests = visibleResult?.items ?? []

  return (
    <section className={styles.card} aria-labelledby={`${config.status.toLocaleLowerCase('vi')}-title`}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 id={`${config.status.toLocaleLowerCase('vi')}-title`}>{title}</h2>
        </div>
        <span className={styles.count}>
          {visibleResult ? t('contestCount', { count: visibleResult.total }) : isLoading ? t('loadingContests') : '—'}
        </span>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            aria-label={t('searchContestLabel', { section: title.toLocaleLowerCase(locale) })}
            placeholder={t('searchContestPlaceholder')}
            maxLength={120}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <label className={styles.sort}>
          <span>{t('sortLabel')}</span>
          <select
            aria-label={`${t('sortLabel')} ${title.toLocaleLowerCase(locale)}`}
            value={sortValue}
            onChange={(event) => {
              setSortValue(event.target.value)
              setPage(1)
            }}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.paginationTop}>
        <SubmissionPagination {...paginationProps} showPageSize={false} />
      </div>

      {isLoading ? (
        <div className={styles.empty} role="status" aria-live="polite">
          <strong>{t('loadingContests')}</strong>
        </div>
      ) : error ? (
        <div className={styles.empty} role="alert">
          <strong>{t('loadContestsError')}</strong>
          <p>{error}</p>
          <button type="button" className={styles.retryButton} onClick={() => setRetryKey((key) => key + 1)}>
            {t('retry', { ns: 'common' })}
          </button>
        </div>
      ) : contests.length === 0 ? (
        <div className={styles.empty}>
          <strong>{query ? t('noMatchingContests') : t('noContests')}</strong>
          <p>{query ? t('changeSearchTerm') : t('contestsWillAppear')}</p>
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label={title} tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('contestName')}</th>
                <th scope="col" className={styles.participantColumn}>{t('participants')}</th>
                <th scope="col" className={styles.actionColumn}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((contest) => (
                <tr key={contest.id}>
                  <td>
                    <div className={styles.contestDetails}>
                      <Link
                        className={styles.contestTitle}
                        to={`/contests/${encodeURIComponent(contest.slug)}`}
                      >
                        {contest.title}
                      </Link>
                      <div className={styles.metadata}>
                        <span><b>{t('startTime')}</b> {formatContestDate(contest.startsAt, locale)}</span>
                        <span><b>{t('endTime')}</b> {formatContestDate(contest.endsAt, locale)}</span>
                        <span><b>{t('contestDuration')}</b> {getContestDurationMinutes(contest)} {t('minutes')}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.participantCell}>
                    <span aria-label={t('participantRegistrationCount', { count: contest.participantCount })}>
                      {contest.participantCount.toLocaleString(locale)}
                    </span>
                  </td>
                  <td className={styles.actionCell}>
                    <Link
                      className={styles.actionButton}
                      to={`/contests/${encodeURIComponent(contest.slug)}`}
                    >
                      {contest.isRegistered ? (
                        <>
                          <Check size={16} aria-hidden="true" />
                          <span>{t('registered')}</span>
                        </>
                      ) : t(config.actionKey)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.paginationBottom}>
        <SubmissionPagination {...paginationProps} />
      </div>
    </section>
  )
}

function ContestsPage() {
  const { t } = useTranslation('pages')
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>{t('contestsTitle')}</h1>
        <div className={styles.sections}>
          {sections.map((config) => <ContestSection key={config.status} config={config} />)}
        </div>
      </div>
    </main>
  )
}

export default ContestsPage
