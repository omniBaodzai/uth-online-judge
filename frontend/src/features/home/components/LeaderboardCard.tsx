import type { RankedPerson } from '../data'
import styles from './LeaderboardCard.module.css'

type LeaderboardCardProps = {
  title: string
  description: string
  people: RankedPerson[]
  id: string
}

function LeaderboardCard({ title, description, people, id }: LeaderboardCardProps) {
  return (
    <section className={styles.card} id={id} aria-labelledby={`${id}-title`}>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.eyebrow}>CỘNG ĐỒNG UTH</p>
          <h2 className={styles.title} id={`${id}-title`}>
            {title}
          </h2>
          <p className={styles.description}>{description}</p>
        </div>
        <span className={styles.headerMark} aria-hidden="true">
          {title === 'Bảng xếp hạng' ? '01' : '★'}
        </span>
      </div>

      <ol className={styles.list}>
        {people.map((person, index) => (
          <li
            className={`${styles.person} ${index === 0 ? styles.firstPlace : ''}`}
            key={person.handle}
          >
            <span className={styles.rank} aria-label={`Hạng ${index + 1}`}>
              {index + 1}
            </span>
            <span className={styles.avatar} aria-hidden="true">
              {person.name
                .split(' ')
                .slice(-2)
                .map((part) => part[0])
                .join('')}
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

      <a className={styles.viewAll} href="#community">
        Khám phá cộng đồng
        <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}

export default LeaderboardCard
