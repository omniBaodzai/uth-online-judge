import { useTranslation } from 'react-i18next'
import { FileText, Send, Trophy } from 'lucide-react'
import OrganizationTabState from '../components/OrganizationTabState'
import styles from './OrganizationDetailPage.module.css'

// Development-only gallery of static UI states. It reads no auth or permission data.
function OrganizationPreviewPage() {
  const { t } = useTranslation('pages')
  return (
    <main className={styles.main} id="main-content">
      <div className={`${styles.container} ${styles.previewStack}`}>
        <h1 className={styles.title}>Organization UI preview (DEV)</h1>
        <h3>EMPTY</h3>
        <OrganizationTabState kind="empty" icon={FileText} emptyText={t('organizationTabNoData_problems')} />
        <h3>PRIVATE</h3>
        <OrganizationTabState kind="private" icon={Trophy} />
        <h3>LOADING</h3>
        <OrganizationTabState kind="loading" icon={Send} />
        <h3>ERROR</h3>
        <OrganizationTabState kind="error" icon={Send} />
        <h3>ARCHIVED</h3>
        <p className={styles.archivedNotice}>{t('organizationArchivedNotice')}</p>
        <h3>STATUS</h3>
        <p>
          <span className={styles.statusBadge}>{t('organizationStatusActive')}</span>{' '}
          <span className={`${styles.statusBadge} ${styles.statusArchived}`}>{t('organizationStatusArchived')}</span>
        </p>
      </div>
    </main>
  )
}

export default OrganizationPreviewPage
