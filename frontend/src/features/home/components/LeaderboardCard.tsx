import type { RankedPerson } from '../data'
import { Link } from 'react-router-dom'
import { resolveAvatarUrl } from '../../auth/api'
import FlameBorder from './FlameBorder'
import styles from './LeaderboardCard.module.css'

type LeaderboardCardProps = {
  title: string
  description: string
  people: RankedPerson[]
  id: string
  href?: string
  loading?: boolean
  error?: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((part) => part[0])
    .join('')
}

function LeaderboardCard({ title, description, people, id, href, loading = false, error }: LeaderboardCardProps) {
  return (
    <section className={styles.card} id={id} aria-labelledby={`${id}-title`}>
      <header className={styles.cardHeader}>
        <div className={styles.headingRow}>
          <h2 className={styles.title} id={`${id}-title`}>{title}</h2>
          {href ? <Link className={styles.viewAll} to={href}>Xem tất cả</Link> : null}
        </div>
        <p className={styles.description}>{description}</p>
      </header>

      {loading ? <p className={styles.message} role="status">Đang tải bảng xếp hạng…</p> : null}
      {error ? <p className={styles.message} role="alert">{error}</p> : null}
      {!loading && !error && people.length === 0 ? <p className={styles.message}>Chưa có thành tích để hiển thị.</p> : null}
      {!loading && !error && people.length > 0 ? (
        <ol className={styles.list}>
          {people.map((person, index) => {
            const avatarUrl = resolveAvatarUrl(person.avatarUrl)
            return (
              <li
                className={`${styles.person} ${index < 3 ? styles[`top${index + 1}`] : ''}`}
                key={person.handle}
              >
                {index === 0 ? <FlameBorder /> : null}
                <span className={styles.rank} aria-label={`Hạng ${index + 1}`}>
                  {index + 1}
                </span>
                <span className={styles.avatar} aria-hidden="true">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(person.name)}
                </span>
                <span className={styles.identity}>
                  <span className={styles.name}>{person.name}</span>
                  <span className={styles.handle}>@{person.handle}</span>
                </span>
                <span className={styles.score}>
                  <strong>{person.score}</strong>
                  <span>{person.scoreLabel}</span>
                </span>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}

export default LeaderboardCard
