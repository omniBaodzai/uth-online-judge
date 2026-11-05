import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import { buildLoginPath } from '../../auth/return-path'
import { useAuth } from '../../auth/useAuth'
import { submitProblemReport } from '../../contact/contact-api'
import { reportTypes, type ReportTypeCode } from '../detail-data'
import '../i18n'
import styles from './ReportModal.module.css'

type ReportModalProps = { problemCode: string; onClose: () => void }

function ReportModal({ problemCode, onClose }: ReportModalProps) {
  const { t } = useTranslation('pages')
  const { user, request } = useAuth()
  const location = useLocation()
  const [reportType, setReportType] = useState<ReportTypeCode>(reportTypes[0].value)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function errorKey(caught: unknown): string {
    if (!(caught instanceof ApiError)) return 'problemReportErrorNetwork'
    if (caught.status === 401) return 'problemReportErrorSession'
    if (caught.status === 404) return 'problemReportErrorNotFound'
    if (caught.status === 429) return 'problemReportErrorRateLimit'
    if (caught.status === 400) return 'problemReportErrorValidation'
    return 'problemReportErrorGeneric'
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const content = description.trim()
    if (inFlightRef.current) return
    if (!content) {
      setError(t('problemReportErrorValidation'))
      return
    }
    inFlightRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const report = await submitProblemReport(request, problemCode, { reportType, content })
      setReportId(report.id)
    } catch (caught) {
      setError(t(errorKey(caught)))
    } finally {
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  const loginPath = buildLoginPath(`${location.pathname}${location.search}`)

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h2 id="report-title">{t('problemReportTitle')}</h2>
        {reportId ? (
          <>
            <p className={styles.success} role="status">
              {t('problemReportSuccess')}
            </p>
            <div className={styles.actions}>
              <Link className={styles.secondary} to={`/my/contact-messages/${encodeURIComponent(reportId)}`} onClick={onClose}>
                {t('problemReportTrack')}
              </Link>
              <button className={styles.primary} type="button" onClick={onClose}>{t('close', { ns: 'common' })}</button>
            </div>
          </>
        ) : !user ? (
          <>
            <p className={styles.notice} role="status">{t('problemReportLoginRequired')}</p>
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>{t('cancel', { ns: 'common' })}</button>
              <Link className={styles.primary} to={loginPath}>{t('problemReportLogin')}</Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="report-type">{t('problemReportType')}</label>
            <select
              id="report-type"
              value={reportType}
              disabled={submitting}
              onChange={(event) => setReportType(event.target.value as ReportTypeCode)}
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>{t(type.labelKey)}</option>
              ))}
            </select>
            <label htmlFor="report-description">{t('problemReportDescription')}</label>
            <textarea
              id="report-description"
              required
              rows={5}
              maxLength={1000}
              value={description}
              disabled={submitting}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'report-error' : undefined}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('problemReportDescriptionPlaceholder')}
            />
            {error && <p id="report-error" className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>{t('cancel', { ns: 'common' })}</button>
              <button className={styles.primary} type="submit" disabled={submitting}>
                {submitting ? t('problemReportSubmitting') : t('problemReportIssue')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ReportModal
