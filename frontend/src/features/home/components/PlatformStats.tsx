import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { request } from '../../auth/api'
import styles from './PlatformStats.module.css'

type PlatformStatsData = {
  members: number
  problems: number
  submissions: number
}

const statKeys: Array<keyof PlatformStatsData> = ['members', 'problems', 'submissions']

function PlatformStats() {
  const { t, i18n } = useTranslation('home')
  const [stats, setStats] = useState<PlatformStatsData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    request<PlatformStatsData>('/public/stats')
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <dl
      className={styles.stats}
      aria-label={error ? t('platformStatsError') : t('platformStats')}
      aria-busy={!stats && !error}
    >
      {statKeys.map((key) => (
        <div className={styles.stat} key={key}>
          <dt className={styles.value}>
            {stats ? new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN').format(stats[key]) : '—'}
          </dt>
          <dd className={styles.label}>{t(key)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default PlatformStats
