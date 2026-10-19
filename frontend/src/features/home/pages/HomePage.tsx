import SiteFooter from '../../../components/layout/SiteFooter'
import SiteHeader from '../../../components/layout/SiteHeader'
import HeroBanner from '../components/HeroBanner'
import CommunityFeed from '../components/CommunityFeed'
import LeaderboardCard from '../components/LeaderboardCard'
import { topContributors, topSolvers } from '../data'
import styles from './HomePage.module.css'

function HomePage() {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Bỏ qua điều hướng, đến nội dung chính
      </a>
      <div className={styles.heroShell}>
        <SiteHeader />
        <HeroBanner />
      </div>

      <main className={styles.main} id="main-content">
        <div className={styles.contentGrid}>
          <CommunityFeed />
          <aside className={styles.sidebar} aria-label="Bảng xếp hạng cộng đồng">
            <LeaderboardCard
              id="leaderboard"
              title="Bảng xếp hạng"
              description="Những thành viên giải được nhiều bài nhất"
              people={topSolvers}
            />
            <LeaderboardCard
              id="contributors"
              title="Top đóng góp"
              description="Những người xây dựng kho bài tập UTH"
              people={topContributors}
            />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}

export default HomePage
