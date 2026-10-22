import { Link } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import {
  OrganizationContestsTab,
  OrganizationHomeTab,
  OrganizationMembersTab,
  OrganizationSubmissionsTab,
} from '../components/OrganizationTabs'
import OrganizationProblemsTab from '../components/OrganizationProblemsTab'
import { getOrganization, organizationTabs, type OrganizationTab } from '../data'
import styles from './OrganizationDetailPage.module.css'

type OrganizationDetailPageProps = {
  organizationId: string
  tab: OrganizationTab
}

function OrganizationDetailPage({ organizationId, tab }: OrganizationDetailPageProps) {
  const organization = getOrganization(organizationId)

  if (!organization) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.main}>
          <section className={styles.card}>
            <div className={styles.cardBody}>
              <h1>Không tìm thấy tổ chức</h1>
              <p>Tổ chức <strong>{organizationId}</strong> không tồn tại.</p>
              <Link className={styles.primaryLink} to="/organizations">← Quay lại danh sách tổ chức</Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main} id="main-content">
        <nav className={styles.breadcrumb} aria-label="Điều hướng đường dẫn">
          <Link to="/organizations">Tổ chức</Link><span aria-hidden="true">/</span><span>{organization.name}</span>
        </nav>

        <header className={styles.header}>
          <h1>{organization.name}</h1>
          <p>{organization.fullName}</p>
        </header>

        <nav className={styles.tabs} aria-label="Menu tổ chức">
          {organizationTabs.map((item) => (
            <Link
              key={item.key}
              to={`/organizations/${organization.id}${item.path}`}
              className={item.key === tab ? styles.activeTab : ''}
              aria-current={item.key === tab ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {tab === 'home' && <OrganizationHomeTab organization={organization} />}
        {tab === 'members' && <OrganizationMembersTab organization={organization} />}
        {tab === 'problems' && <OrganizationProblemsTab organization={organization} />}
        {tab === 'contests' && <OrganizationContestsTab organization={organization} />}
        {tab === 'submissions' && <OrganizationSubmissionsTab organization={organization} />}
      </main>
    </div>
  )
}

export default OrganizationDetailPage
