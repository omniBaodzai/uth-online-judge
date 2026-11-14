import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../../profile/components/UserAvatar'
import styles from '../pages/LeaderboardPage.module.css'

export interface RankingRow {
  id: string
  rank: number
  points?: number
  displayName: string
  handle: string
  avatarSource?: string | null
  count: number
  profileUsername?: string | null
  detail?: string | null
  isViewer?: boolean
  latestContributionAt?: string | null
}

interface RankingTableProps {
  rows: RankingRow[]
  ariaLabel: string
  countHeading: string
  latestContributionHeading?: string
}

function RankingTable({ rows, ariaLabel, countHeading, latestContributionHeading }: RankingTableProps) {
  const { t, i18n } = useTranslation('pages')
  const dateLocale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN'
  const contributionDateFormatter = useMemo(() => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }), [dateLocale])

  function formatContributionDate(value: string | null | undefined) {
    if (!value) return '—'
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? '—' : contributionDateFormatter.format(timestamp)
  }

  return (
    <div className={styles.tableScroll} tabIndex={0} aria-label={ariaLabel}>
      <div className={styles.listHeader} aria-hidden="true">
        <span>{t('rankHeading')}</span>
        <span>{latestContributionHeading ?? t('pointsHeading')}</span>
        <span>{t('coderHeading')}</span>
        <span>{countHeading}</span>
      </div>
      <ol className={styles.list}>
        {rows.map((row) => {
          const isTopThree = row.rank >= 1 && row.rank <= 3
          const rowContent = (
            <>
              <span className={styles.rank} aria-label={t('coderRank', { rank: row.rank })}>
                {row.rank === 1 ? <Crown className={styles.crown} size={16} aria-hidden="true" /> : null}
                <span className={styles.rankNumber}>{row.rank}</span>
              </span>
              {latestContributionHeading ? <span className={styles.achievement}>{formatContributionDate(row.latestContributionAt)}</span> : <span className={styles.points}>{row.points ?? 0}</span>}
              <span className={styles.coder}>
                <UserAvatar source={row.avatarSource ?? null} username={row.profileUsername ?? row.displayName} label={t('userAvatar', { name: row.displayName })} />
                <span className={styles.identity}>
                  <strong>{row.displayName}</strong>
                  <span>@{row.handle}</span>
                  {row.detail ? <span className={styles.performance}>{row.detail}</span> : null}
                </span>
              </span>
              <span className={styles.solvedCount}>{row.count}</span>
            </>
          )
          return (
            <li className={`${styles.entry} ${isTopThree ? styles[`top${row.rank}`] : ''} ${row.isViewer ? styles.viewer : ''}`} key={row.id} aria-current={row.isViewer ? 'true' : undefined}>
              {row.profileUsername ? (
                <Link className={`${styles.row} ${styles.rowLink}`} to={`/users/${encodeURIComponent(row.profileUsername)}`} aria-label={t('profileRank', { name: row.displayName, rank: row.rank })}>
                  {rowContent}
                </Link>
              ) : (
                <div className={styles.row}>{rowContent}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default RankingTable
