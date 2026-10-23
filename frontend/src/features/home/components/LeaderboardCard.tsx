import type { RankedPerson } from '../data'
import styles from './LeaderboardCard.module.css'

type LeaderboardCardProps = {
  title: string
  description: string
  people: RankedPerson[]
  id: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((part) => part[0])
    .join('')
}

function LeaderboardCard({ title, description, people, id }: LeaderboardCardProps) {
  return (
    <section className={styles.card} id={id} aria-labelledby={`${id}-title`}>
      <header className={styles.cardHeader}>
        <h2 className={styles.title} id={`${id}-title`}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </header>

      <ol className={styles.list}>
        {people.map((person, index) => (
          <li
            className={`${styles.person} ${index < 3 ? styles[`top${index + 1}`] : ''}`}
            key={person.handle}
          >
            <span className={styles.rank} aria-label={`Hạng ${index + 1}`}>
              {index + 1}
            </span>
            <span className={styles.avatar} aria-hidden="true">
              {getInitials(person.name)}
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
        ))}
      </ol>
    </section>
  )
}

export default LeaderboardCard
