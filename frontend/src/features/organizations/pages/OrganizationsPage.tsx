import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import styles from '../../leaderboard/pages/LeaderboardPage.module.css'
import UserAvatar from '../../profile/components/UserAvatar'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import OrganizationRequestModal from '../components/OrganizationRequestModal'
import { listOrganizations, type OrganizationSummary } from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import pageStyles from './OrganizationsPage.module.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function OrganizationsPage() {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [requestOpen, setRequestOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<OrganizationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    listOrganizations(api, { page, pageSize: PAGE_SIZE, q: debouncedQuery, sort: 'members' }, controller.signal)
      .then((result) => {
        setItems(result.items)
        setTotal(result.total)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, page, debouncedQuery, reloadKey])

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
        <header className={`${styles.header} ${pageStyles.headerRow}`}>
          <h1>{t('organizationsTitle')}</h1>
          <button className={pageStyles.requestButton} type="button" onClick={() => setRequestOpen(true)}>
            <Building2 size={17} aria-hidden="true" />
            <span>{t('organizationRequestButton')}</span>
          </button>
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
          {loading ? (
            <p className={styles.state} role="status" aria-busy="true">{t('organizationTabLoading')}</p>
          ) : failed ? (
            <p className={styles.state} role="alert">
              {t('organizationsLoadError')}{' '}
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>{t('organizationsRetry')}</button>
            </p>
          ) : items.length === 0 ? (
            <p className={styles.state}>{debouncedQuery ? t('noMatchingOrganizations') : t('noOrganizations')}</p>
          ) : (
            <div
              className={`${styles.tableScroll} ${styles.twoColumns}`}
              tabIndex={0}
              aria-label={t('organizationsList')}
            >
              <div className={styles.listHeader} aria-hidden="true">
                <span>{t('organizationNameHeading')}</span>
                <span>{t('membersHeading')}</span>
              </div>
              <ol className={styles.list}>
                {items.map((item) => (
                  <li className={styles.entry} key={item.id}>
                    <div className={styles.row}>
                      <span className={styles.coder}>
                        <UserAvatar
                          source={null}
                          username={item.name}
                          label={t('organizationLogo', { name: item.name })}
                        />
                        <span className={styles.identity}>
                          <strong>
                            <Link className={styles.entityLink} to={`/organizations/${encodeURIComponent(item.slug)}`}>
                              {item.name}
                            </Link>
                          </strong>
                        </span>
                      </span>
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
      {requestOpen && <OrganizationRequestModal onClose={() => setRequestOpen(false)} />}
    </main>
  )
}

export default OrganizationsPage
