import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveAvatarUrl } from '../../auth/api'
import RankingTable from '../../leaderboard/components/RankingTable'
import styles from '../../leaderboard/pages/LeaderboardPage.module.css'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { useContributorsData } from '../useContributorsData'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function ContributorsPage() {
  const { t } = useTranslation('pages')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error } = useContributorsData({ page, pageSize: PAGE_SIZE, q: debouncedQuery })

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const paginationProps = {
    currentPage: page,
    pageSize: PAGE_SIZE,
    totalItems: data?.total ?? 0,
    pageSizes: [PAGE_SIZE],
    label: t('contributorsPaginationLabel'),
    summaryLabel: t('contributorsPaginationLabel'),
    additionalSummary: debouncedQuery && data ? t('contributorsTotalSummary', { count: data.totalContributors }) : undefined,
    showPageSize: false,
    onPageChange: setPage,
    onPageSizeChange: () => undefined,
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>{t('contributorsTitle')}</h1>
          <p></p>
        </header>

        <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
          <div className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label={t('contributorsSearch')}
              maxLength={100}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder={t('searchContributor')}
            />
          </div>
        </form>

        <section className={styles.card} aria-label={t('contributorsTitle')}>
          {data ? (
            <div className={styles.topPagination}>
              <SubmissionPagination {...paginationProps} />
            </div>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {t('contributorsLoadError')}
            </p>
          ) : null}
          {loading && !data ? (
            <p className={styles.state} role="status">
              {t('loadingLeaderboard')}
            </p>
          ) : null}
          {!loading && !error && data?.items.length === 0 ? (
            <p className={styles.state}>{debouncedQuery ? t('noMatchingCoders') : t('noCoders')}</p>
          ) : !error && data?.items.length ? (
            <RankingTable
              rows={data.items.map((item) => ({
                id: item.userId,
                rank: item.rank,
                displayName: item.displayName,
                handle: item.username ?? item.userId.slice(0, 8),
                avatarSource: resolveAvatarUrl(item.avatarUrl),
                count: item.contributionCount,
                profileUsername: item.username,
                latestContributionAt: item.latestContributionAt,
              }))}
              ariaLabel={t('contributorsList')}
              countHeading={t('contributedHeading')}
              latestContributionHeading={t('latestContributionHeading')}
            />
          ) : null}
          {data ? (
            <div className={styles.footer}>
              <SubmissionPagination {...paginationProps} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default ContributorsPage
