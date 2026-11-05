import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveAvatarUrl } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import RankingTable from '../components/RankingTable'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { useLeaderboardData } from '../useLeaderboardData'
import styles from './LeaderboardPage.module.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function formatPerformance(
  percentile: number | null,
  comparableProblems: number,
  t: (key: 'notEnoughData' | 'topPercent', options?: Record<string, number>) => string,
): string {
  if (percentile === null || comparableProblems === 0) return t('notEnoughData')
  return t('topPercent', {
    percentile: Math.max(1, Math.ceil(percentile * 100)),
    count: comparableProblems,
  })
}

function LeaderboardPage() {
  const { t } = useTranslation('pages')
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error } = useLeaderboardData({ page, pageSize: PAGE_SIZE, q: debouncedQuery })
  const pageItems = data?.items ?? []
  const totalUsers = data?.totalUsers ?? (debouncedQuery ? null : data?.total ?? 0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const paginationProps = {
    currentPage: page,
    pageSize: PAGE_SIZE,
    totalItems: data?.total ?? 0,
    pageSizes: [PAGE_SIZE],
    label: t('coderPaginationLabel'),
    summaryLabel: t('coderPaginationLabel'),
    additionalSummary: debouncedQuery && totalUsers !== null ? t('coderTotalSummary', { count: totalUsers }) : undefined,
    showPageSize: false,
    onPageChange: setPage,
    onPageSizeChange: () => undefined,
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>{t('leaderboardTitle')}</h1>
          <p></p>
        </header>

        {user && data?.viewerRank ? (
          <p className={styles.viewerRank} role="status">{t('yourRank')} <strong>#{data.viewerRank}</strong></p>
        ) : user && data && !loading ? (
          <p className={styles.viewerRank} role="status">{t('noRankYet')}</p>
        ) : null}

        <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
          <div className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label={t('leaderboardSearch')}
              maxLength={100}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder={t('searchCoder')}
            />
          </div>
        </form>

        <section className={styles.card} aria-label={t('leaderboardTitle')}>
          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} />
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {loading && !data ? <p className={styles.state} role="status">{t('loadingLeaderboard')}</p> : null}
          {!loading && !error && data && pageItems.length === 0 ? (
            <p className={styles.state}>{query ? t('noMatchingCoders') : t('noCoders')}</p>
          ) : null}
          {!error && pageItems.length > 0 ? (
            <RankingTable
              rows={pageItems.map((entry) => ({
                id: entry.userId,
                rank: entry.rank,
                points: entry.cumulativePoints,
                displayName: entry.displayName,
                handle: entry.username ?? entry.userId.slice(0, 8),
                avatarSource: resolveAvatarUrl(entry.avatarUrl),
                count: entry.solvedCount,
                profileUsername: entry.username,
                detail: entry.comparableProblems > 0
                  ? formatPerformance(entry.performancePercentile, entry.comparableProblems, t)
                  : null,
                isViewer: entry.userId === user?.id,
              }))}
              ariaLabel={t('rankingList')}
              countHeading={t('solvedHeading')}
            />
          ) : null}
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </section>
      </div>
    </main>
  )
}

export default LeaderboardPage
