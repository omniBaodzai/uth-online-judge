import HeroBanner from '../components/HeroBanner'
import CommunityFeed from '../components/CommunityFeed'
import LeaderboardCard from '../components/LeaderboardCard'
import { topContributors } from '../data'
import { useLeaderboardData } from '../../leaderboard/useLeaderboardData'
import styles from './HomePage.module.css'
import { useTranslation } from 'react-i18next'

function HomePage() {
  const { t: translateCommon } = useTranslation('common')
  const { t } = useTranslation('home')
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError } = useLeaderboardData({ page: 1, pageSize: 5 })
  const topSolvers = leaderboard?.items.map((person) => ({
    name: person.displayName,
    handle: person.username ?? person.userId.slice(0, 8),
    profileUsername: person.username,
    score: person.solvedCount,
    scoreLabel: t('solvedScoreLabel'),
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
          <aside className={styles.sidebar} aria-label={t('communityLeaderboard')}>
            <LeaderboardCard
              id="leaderboard"
              title={translateCommon('leaderboard')}
              description={t('topSolvers')}
              people={topSolvers}
              href="/leaderboard"
              loading={leaderboardLoading}
              error={leaderboardError}
            />
            <LeaderboardCard
              id="contributors"
              title={t('topContributors')}
              description={t('contributorsDescription')}
              href="/contributors"
              people={topContributors.map((person) => ({
                ...person,
                scoreLabel: t('contributionScoreLabel'),
              }))}
            />
          </aside>
        </div>
      </main>
    </>
  )
}

export default HomePage
