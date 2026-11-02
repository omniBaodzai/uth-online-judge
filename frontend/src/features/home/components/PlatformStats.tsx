import { useEffect, useState } from 'react'
import { request } from '../../auth/api'
import styles from './PlatformStats.module.css'

type PlatformStatsData = {
  members: number
  problems: number
  submissions: number
}

const statLabels: Array<{ key: keyof PlatformStatsData; label: string }> = [
  { key: 'members', label: 'thành viên' },
  { key: 'problems', label: 'bài tập' },
  { key: 'submissions', label: 'bài nộp' },
]

function PlatformStats() {
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
      aria-label={error ? 'Không thể tải thống kê nền tảng.' : 'Thống kê nền tảng'}
      aria-busy={!stats && !error}
    >
      {statLabels.map(({ key, label }) => (
        <div className={styles.stat} key={label}>
          <dt className={styles.value}>
            {stats ? new Intl.NumberFormat('vi-VN').format(stats[key]) : '—'}
          </dt>
          <dd className={styles.label}>{label}</dd>
        </div>
      ))}
    </dl>
  )
}

export default PlatformStats
