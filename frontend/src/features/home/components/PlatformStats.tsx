import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { request } from '../../auth/api'
import styles from './PlatformStats.module.css'

type PlatformStatsData = {
  members: number
  problems: number
  submissions: number
}

const statKeys: Array<keyof PlatformStatsData> = ['members', 'problems', 'submissions']
const statRoutes: Record<keyof PlatformStatsData, string> = {
  members: '/leaderboard',
  problems: '/problems',
  submissions: '/submissions',
}
const COUNT_UP_MS = 1000

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CountUpValue({ value, locale }: { value: number; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0))

  useEffect(() => {
    if (progress >= 1) return

    let frame = 0
    let observer: IntersectionObserver | null = null
    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const ratio = Math.min((now - start) / COUNT_UP_MS, 1)
        setProgress(1 - (1 - ratio) ** 3)
        if (ratio < 1) frame = requestAnimationFrame(tick)
        else setProgress(1)
      }
      frame = requestAnimationFrame(tick)
    }

    if (typeof IntersectionObserver === 'undefined' || !ref.current) {
      frame = requestAnimationFrame(run)
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect()
          run()
        }
      })
      observer.observe(ref.current)
    }

    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
    // Runs once per mount; progress only gates the initial setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shown = progress >= 1 ? value : Math.round(value * progress)
  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {new Intl.NumberFormat(locale).format(shown)}
    </span>
  )
}

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
    <nav
      className={styles.stats}
      aria-label={error ? t('platformStatsError') : t('platformStats')}
      aria-busy={!stats && !error}
    >
      {statKeys.map((key) => (
        <Link className={styles.stat} key={key} to={statRoutes[key]}>
          <span className={styles.value}>
            {stats ? (
              <CountUpValue
                value={stats[key]}
                locale={i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'}
              />
            ) : '—'}
          </span>
          <span className={styles.label}>{t(key)}</span>
        </Link>
      ))}
    </nav>
  )
}

export default PlatformStats
