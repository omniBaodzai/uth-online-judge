import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from '../../leaderboard/pages/LeaderboardPage.module.css'
import UserAvatar from '../../profile/components/UserAvatar'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { getOrganizationsPage } from '../data'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function OrganizationsPage() {
  const { t } = useTranslation('pages')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const { items, total } = useMemo(
    () => getOrganizationsPage({ page, pageSize: PAGE_SIZE, q: debouncedQuery }),
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
    label: t('organizationPaginationLabel'),
    summaryLabel: t('organizationPaginationLabel'),
    showPageSize: false,
    onPageChange: setPage,
    onPageSizeChange: () => undefined,
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>{t('organizationsTitle')}</h1>
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
              aria-label={t('organizationsSearch')}
              maxLength={100}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder={t('searchOrganization')}
            />
          </div>
        </form>

        <section className={styles.card} aria-label={t('organizationsTitle')}>
          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} />
          </div>
          {items.length === 0 ? (
            <p className={styles.state}>{debouncedQuery ? t('noMatchingOrganizations') : t('noOrganizations')}</p>
          ) : (
            <div
              className={`${styles.tableScroll} ${styles.threeColumns}`}
              tabIndex={0}
              aria-label={t('organizationsList')}
            >
              <div className={styles.listHeader} aria-hidden="true">
                <span>{t('organizationNameHeading')}</span>
                <span>{t('pointsHeading')}</span>
                <span>{t('membersHeading')}</span>
              </div>
              <ol className={styles.list}>
                {items.map((item) => (
                  <li className={styles.entry} key={item.id}>
                    <div className={styles.row}>
                      <span className={styles.coder}>
                        <UserAvatar
                          source={item.logoUrl ?? null}
                          username={item.name}
                          label={t('organizationLogo', { name: item.name })}
                        />
                        <span className={styles.identity}>
                          <strong>{item.name}</strong>
                        </span>
                      </span>
                      <span className={styles.points}>{item.score}</span>
                      <span className={styles.solvedCount}>{item.memberCount}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </section>
      </div>
    </main>
  )
}

export default OrganizationsPage
