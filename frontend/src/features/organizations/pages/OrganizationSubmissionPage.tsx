import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileCode2 } from 'lucide-react'
import { useOrganizationsApi } from '../useOrganizationsApi'
import OrganizationTabState from '../components/OrganizationTabState'
import {
  errorMessage,
  getOrganizationSubmission,
  getOrganizationSubmissionSource,
  type OrganizationSubmissionDetail,
} from '../organizations-api'
import styles from './OrganizationSubmitPage.module.css'

export default function OrganizationSubmissionPage() {
  const { t, i18n } = useTranslation('pages')
  const { organizationId: slug = '', submissionId = '' } = useParams()
  const api = useOrganizationsApi()
  const [submission, setSubmission] = useState<OrganizationSubmissionDetail | null>(null)
  const [loadedSubmissionId, setLoadedSubmissionId] = useState('')
  const [error, setError] = useState('')
  const [source, setSource] = useState<string | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'

  useEffect(() => {
    const controller = new AbortController()
    getOrganizationSubmission(api, slug, submissionId, controller.signal)
      .then((result) => {
        setSubmission(result)
        setError('')
        setSource(null)
        setSourceError('')
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, t('organizationSubmissionLoadError')))
      })
      .finally(() => { if (!controller.signal.aborted) setLoadedSubmissionId(submissionId) })
    return () => controller.abort()
  }, [api, slug, submissionId, t])

  const loading = loadedSubmissionId !== submissionId

  async function loadSource() {
    if (sourceLoading || source !== null) return
    setSourceLoading(true)
    setSourceError('')
    try {
      const result = await getOrganizationSubmissionSource(api, slug, submissionId)
      setSource(result.sourceCode)
    } catch (caught) {
      setSourceError(errorMessage(caught, t('organizationSubmissionSourceError')))
    } finally {
      setSourceLoading(false)
    }
  }

  if (loading) {
    return <main className={styles.main} id="main-content"><div className={styles.container}><OrganizationTabState kind="loading" icon={FileCode2} /></div></main>
  }
  if (error || !submission) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <OrganizationTabState kind="error" icon={FileCode2}><p>{error || t('organizationSubmissionLoadError')}</p></OrganizationTabState>
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}/submissions`}>{t('organizationSubmissionBack')}</Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <nav className={styles.navigation} aria-label={t('organizationSubmissionNavigation')}>
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}/submissions`}>{t('organizationSubmissionBack')}</Link>
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}/submissions/mine`}>{t('organizationMySubmissions')}</Link>
        </nav>
        <article className={styles.submissionCard}>
          <h1>{submission.problemCode} — {submission.problemTitle}</h1>
          <dl>
            <div><dt>{t('organizationSubmissionStatus')}</dt><dd>{submission.status.replaceAll('_', ' ')}</dd></div>
            <div><dt>{t('language')}</dt><dd>{submission.language}</dd></div>
            <div><dt>{t('organizationSubmissionScore')}</dt><dd>{submission.scoringEnabled ? `${submission.score} / ${submission.maxScore}` : '—'}</dd></div>
            <div><dt>{t('organizationSubmissionSubmittedAt')}</dt><dd>{new Date(submission.submittedAt).toLocaleString(locale)}</dd></div>
            <div><dt>{t('organizationSubmissionJudgedAt')}</dt><dd>{submission.judgedAt ? new Date(submission.judgedAt).toLocaleString(locale) : '—'}</dd></div>
          </dl>
          <h2>{t('organizationSubmissionTestResults')}</h2>
          {submission.testResults.length === 0 ? <p>{t('organizationSubmissionPending')}</p> : (
            <ol>
              {submission.testResults.map((result) => (
                <li key={result.position}>
                  {t('organizationSubmissionTestNumber', { number: result.position })}: {result.status ?? t('organizationSubmissionPending')}
                  {submission.scoringEnabled ? ` · ${result.pointsAwarded} / ${result.maxPoints}` : ''}
                </li>
              ))}
            </ol>
          )}
          <div className={styles.source}>
            <button type="button" className={styles.back} disabled={sourceLoading} onClick={() => void loadSource()}>
              {sourceLoading ? t('organizationContentLoading') : t('organizationSubmissionViewSource')}
            </button>
            {sourceError && <p role="alert">{sourceError}</p>}
            {source !== null && <pre><code>{source}</code></pre>}
          </div>
        </article>
      </div>
    </main>
  )
}
