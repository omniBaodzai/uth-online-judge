import { Link } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import { organizations, type Organization } from '../data'
import styles from './OrganizationsPage.module.css'

function OrganizationTable({ items, caption }: { items: Organization[]; caption: string }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Tên tổ chức</th>
            <th scope="col" className={styles.numeric}>Điểm</th>
            <th scope="col" className={styles.numeric}>Thành viên</th>
          </tr>
        </thead>
        <tbody>
          {items.map((organization) => (
            <tr key={organization.id}>
              <td>
                <Link className={styles.orgLink} to={`/organizations/${organization.id}`}>{organization.name}</Link>
                <span className={styles.orgDescription}>{organization.fullName}</span>
              </td>
              <td className={styles.numeric}>{organization.score.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}</td>
              <td className={styles.numeric}>{organization.memberCount.toLocaleString('vi-VN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrganizationsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const mine = organizations.filter((organization) => organization.joined)
  const others = organizations.filter((organization) => !organization.joined)

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main} id="main-content">
        <div className={styles.intro}>
          <p className={styles.eyebrow}>CỘNG ĐỒNG</p>
          <h1>Tổ chức</h1>
        </div>

        <section className={styles.panel} aria-labelledby="my-orgs">
          <h2 id="my-orgs">Tổ chức của bạn</h2>
          {isLoading ? (
            <p className={styles.empty}>Đang tải...</p>
          ) : !isAuthenticated ? (
            <p className={styles.empty}><Link to="/login">Đăng nhập</Link> để xem các tổ chức bạn tham gia.</p>
          ) : mine.length === 0 ? (
            <p className={styles.empty}>Bạn chưa tham gia tổ chức nào.</p>
          ) : (
            <OrganizationTable items={mine} caption="Tổ chức của bạn" />
          )}
        </section>

        <section className={styles.panel} aria-labelledby="all-orgs">
          <h2 id="all-orgs">Tất cả tổ chức</h2>
          <OrganizationTable items={others} caption="Tất cả tổ chức" />
        </section>
      </main>
    </div>
  )
}

export default OrganizationsPage
