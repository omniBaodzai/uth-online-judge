import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RankingTable from '../../leaderboard/components/RankingTable'
import styles from '../../leaderboard/pages/LeaderboardPage.module.css'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { getContributorsPage } from '../data'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function ContributorsPage() {
  const { t } = useTranslation('pages')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const { items, total } = useMemo(
    () => getContributorsPage({ page, pageSize: PAGE_SIZE, q: debouncedQuery }),
    [page, debouncedQuery],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const paginationProps = {
    currentPage: page,
    pageSize: PAGE_SIZE,
    totalItems: total,
    pageSizes: [PAGE_SIZE],
    label: t('coderPaginationLabel'),
    summaryLabel: t('coderPaginationLabel'),
    additionalSummary: debouncedQuery ? t('coderTotalSummary', { count: total }) : undefined,
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
          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} />
          </div>
          {items.length === 0 ? (
            <p className={styles.state}>{debouncedQuery ? t('noMatchingCoders') : t('noCoders')}</p>
          ) : (
            <RankingTable
              rows={items.map((item) => ({
                id: item.id,
                rank: item.rank,
                points: item.points,
                displayName: item.displayName,
                handle: item.username,
                avatarSource: item.avatarUrl,
                count: item.contributedProblems,
              }))}
              ariaLabel={t('contributorsList')}
              countHeading={t('contributedHeading')}
            />
          )}
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </section>
      </div>
    </main>
  )
}

export default ContributorsPage
