import styles from './PlatformStats.module.css'

const platformStats = [
  { value: '1.000+', label: 'thành viên' },
  { value: '212', label: 'bài tập' },
  { value: '1.293+', label: 'bài nộp' },
]

function PlatformStats() {
  return (
    <dl className={styles.stats} aria-label="Thống kê nền tảng">
      {platformStats.map(({ value, label }) => (
        <div className={styles.stat} key={label}>
          <dt className={styles.value}>{value}</dt>
          <dd className={styles.label}>{label}</dd>
        </div>
      ))}
    </dl>
  )
}

export default PlatformStats
