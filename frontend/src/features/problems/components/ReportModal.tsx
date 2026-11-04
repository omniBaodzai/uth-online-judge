import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { reportTypes } from '../detail-data'
import '../i18n'
import styles from './ReportModal.module.css'

function ReportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('pages')
  const [sent, setSent] = useState(false)

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

  // Giao diện minh họa: chưa gửi dữ liệu đến máy chủ.
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h2 id="report-title">{t('problemReportTitle')}</h2>
        {sent ? (
          <>
            <p className={styles.success} role="status">
              {t('problemReportSuccess')}
            </p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={onClose}>{t('close', { ns: 'common' })}</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="report-type">{t('problemReportType')}</label>
            <select id="report-type" defaultValue={reportTypes[0]}>
              {reportTypes.map((type, index) => (
                <option key={type} value={type}>{t([
                  'problemReportTypeMissingInfo',
                  'problemReportTypeIncorrectTestData',
                  'problemReportTypeDisplayIssue',
                  'problemReportTypeOther',
                ][index])}</option>
              ))}
            </select>
            <label htmlFor="report-description">{t('problemReportDescription')}</label>
            <textarea
              id="report-description"
              required
              rows={5}
              maxLength={1000}
              placeholder={t('problemReportDescriptionPlaceholder')}
            />
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>{t('cancel', { ns: 'common' })}</button>
              <button className={styles.primary} type="submit">{t('problemReportIssue')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ReportModal
