import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import OrganizationTabState from './OrganizationTabState'
import {
  errorMessage,
  listMyOrganizationSubmissions,
  listOrganizationSubmissions,
  type OrganizationSubmission,
} from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import styles from './OrganizationContentPanel.module.css'

type Props = {
  slug?: string
  canViewSubmissions: boolean
  mySubmissions?: boolean
}

export default function OrganizationSubmissionsPanel({
  slug: slugProp,
  canViewSubmissions,
  mySubmissions = false,
}: Props) {
  const { t, i18n } = useTranslation('pages')
  const { organizationId = '' } = useParams()
  const slug = slugProp ?? organizationId
  const { user } = useAuth()
  const api = useOrganizationsApi()
  const [items, setItems] = useState<OrganizationSubmission[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null)
  const pageSize = 10
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const requestKey = JSON.stringify([slug, page, status, mySubmissions])

  useEffect(() => {
    const controller = new AbortController()
    const params = { page, pageSize, ...(status ? { status } : {}) }
    const load = mySubmissions
      ? listMyOrganizationSubmissions(api, slug, params, controller.signal)
      : listOrganizationSubmissions(api, slug, params, controller.signal)
    load.then((result) => {
      setItems(result.items)
      setTotal(result.total)
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError({ key: requestKey, message: errorMessage(caught, t('organizationSubmissionsLoadError')) })
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoadedKey(requestKey)
    })
    return () => controller.abort()
  }, [api, mySubmissions, page, pageSize, requestKey, slug, status, t])

  const loading = loadedKey !== requestKey
  const error = loadError?.key === requestKey ? loadError.message : ''

  if (!mySubmissions && !canViewSubmissions) {
    return (
      <OrganizationTabState kind="private" icon={Send}>
        {user && (
          <Link className={styles.inlineLink} to={`/organizations/${encodeURIComponent(slug)}/submissions/mine`}>
            {t('organizationMySubmissions')}
          </Link>
        )}
      </OrganizationTabState>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="organization-submissions-title">
      <header className={styles.header}>
        <div>
          <h2 id="organization-submissions-title">
            {t(mySubmissions ? 'organizationMySubmissions' : 'organizationTabSubmissions')}
          </h2>
        </div>
        {user && !mySubmissions && (
          <Link className={styles.inlineLink} to={`/organizations/${encodeURIComponent(slug)}/submissions/mine`}>
            {t('organizationMySubmissions')}
          </Link>
        )}
      </header>
      <div className={styles.toolbar}>
        <label>
          <span>{t('organizationSubmissionStatus')}</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
            <option value="">{t('organizationSubmissionAllStatuses')}</option>
            {['PENDING', 'QUEUED', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR', 'INTERNAL_ERROR'].map((value) => (
              <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? <p className={styles.empty}>{t('organizationContentLoading')}</p> : items.length === 0 && !error ? (
        <p className={styles.empty}>{t('organizationSubmissionEmpty')}</p>
      ) : (
        <div className={styles.statement}>
          <ul className={styles.grantList}>
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.problemCode && item.problemTitle
                    ? `${item.problemCode} — ${item.problemTitle}`
                    : item.contestId ? t('organizationSubmissionContest') : t('organizationSubmissionPrivateProblem')}
                  {' · '}{item.status.replaceAll('_', ' ')} · {item.language}
                  {item.username && !mySubmissions ? ` · ${item.username}` : ''}
                  {' · '}{new Date(item.submittedAt).toLocaleString(locale)}
                </span>
                {(mySubmissions || item.canViewDetails) && (
                  <Link className={styles.inlineLink} to={`/organizations/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(item.id)}`}>
                    {t('organizationSubmissionDetails')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <footer className={styles.pagination}>
        <span>{t('organizationContentResultCount', { count: total })}</span>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t('organizationContentPrevious')}</button>
          <button className={styles.secondary} type="button" disabled={page * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)}>{t('organizationContentNext')}</button>
        </div>
      </footer>
    </section>
  )
}
