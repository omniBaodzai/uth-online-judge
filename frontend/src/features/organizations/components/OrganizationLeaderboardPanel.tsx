import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Medal } from 'lucide-react'
import { listOrganizationLeaderboard, type OrganizationLeaderboardEntry } from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import OrganizationTabState from './OrganizationTabState'
import styles from '../pages/OrganizationDetailPage.module.css'

const pageSize = 10

function OrganizationLeaderboardPanel({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [items, setItems] = useState<OrganizationLeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${slug}:${page}:${reloadKey}`
  const [completedRequestKey, setCompletedRequestKey] = useState('')
  const loading = completedRequestKey !== requestKey
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'

  useEffect(() => {
    const controller = new AbortController()
    listOrganizationLeaderboard(api, slug, { page, pageSize }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setItems(result.items)
        setTotal(result.total)
        setFailed(false)
        setCompletedRequestKey(requestKey)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setCompletedRequestKey(requestKey)
        }
      })
    return () => controller.abort()
  }, [api, page, reloadKey, requestKey, slug])

  if (loading) return <OrganizationTabState kind="loading" icon={Medal} />
  if (failed) {
    return (
      <OrganizationTabState kind="error" icon={Medal} errorText={t('organizationLeaderboardLoadError')}>
        <button className={styles.secondaryButton} type="button" onClick={() => setReloadKey((key) => key + 1)}>
          {t('organizationsRetry')}
        </button>
      </OrganizationTabState>
    )
  }
  if (items.length === 0) {
    return <OrganizationTabState kind="empty" icon={Medal} emptyText={t('organizationLeaderboardEmpty')} />
  }

  return (
    <section className={styles.card} aria-label={t('organizationTabLeaderboard')}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('organizationLeaderboardRank')}</th>
              <th scope="col">{t('organizationLeaderboardMember')}</th>
              <th scope="col">{t('organizationLeaderboardSolved')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.userId}>
                <td>{entry.rank.toLocaleString(locale)}</td>
                <td>{entry.username}</td>
                <td>{entry.solvedCount.toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav className={styles.leaderboardPagination} aria-label={t('organizationLeaderboardPagination')}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('organizationLeaderboardPrevious')}
          </button>
          <span aria-live="polite">{t('organizationLeaderboardPage', { page, total: pageCount })}</span>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            {t('organizationLeaderboardNext')}
          </button>
        </nav>
      )}
    </section>
  )
}

export default OrganizationLeaderboardPanel
