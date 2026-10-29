import HeroBanner from '../components/HeroBanner'
import CommunityFeed from '../components/CommunityFeed'
import LeaderboardCard from '../components/LeaderboardCard'
import { topContributors } from '../data'
import { useLeaderboardData } from '../../leaderboard/useLeaderboardData'
import styles from './HomePage.module.css'

function HomePage() {
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError } = useLeaderboardData({ page: 1, pageSize: 5 })
  const topSolvers = leaderboard?.items.map((person) => ({
    name: person.displayName,
    handle: person.username ?? person.userId.slice(0, 8),
    score: person.solvedCount,
    scoreLabel: 'bài AC',
    avatarUrl: person.avatarUrl,
  })) ?? []

  return (
    <>
      <div className={styles.heroShell}>
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
              href="/leaderboard"
              loading={leaderboardLoading}
              error={leaderboardError}
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
    </>
  )
}

export default HomePage
