import HeroBanner from '../components/HeroBanner'
import CommunityFeed from '../components/CommunityFeed'
import LeaderboardCard from '../components/LeaderboardCard'
import { useLeaderboardData } from '../../leaderboard/useLeaderboardData'
import { useContributorsData } from '../../contributors/useContributorsData'
import styles from './HomePage.module.css'
import { useTranslation } from 'react-i18next'

function HomePage() {
  const { t: translateCommon } = useTranslation('common')
  const { t } = useTranslation('home')
  const { t: translatePages } = useTranslation('pages')
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError } = useLeaderboardData({ page: 1, pageSize: 5 })
  const { data: contributors, loading: contributorsLoading, error: contributorsError } = useContributorsData({ page: 1, pageSize: 5 })
  const topSolvers =
    leaderboard?.items.map((person) => ({
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
            <LeaderboardCard id="leaderboard" title={translateCommon('leaderboard')} description={t('topSolvers')} people={topSolvers} href="/leaderboard" loading={leaderboardLoading} error={leaderboardError} />
            <LeaderboardCard
              id="contributors"
              title={t('topContributors')}
              description={t('contributorsDescription')}
              href="/contributors"
              people={(contributors?.items ?? []).slice(0, 5).map((person) => ({
                name: person.displayName,
                handle: person.username ?? person.userId.slice(0, 8),
                profileUsername: person.username,
                score: person.contributionCount,
                scoreLabel: t('contributionScoreLabel'),
                avatarUrl: person.avatarUrl,
              }))}
              loading={contributorsLoading}
              error={contributorsError ? translatePages('contributorsLoadError') : undefined}
            />
          </aside>
        </div>
      </main>
    </>
  )
}

export default HomePage
