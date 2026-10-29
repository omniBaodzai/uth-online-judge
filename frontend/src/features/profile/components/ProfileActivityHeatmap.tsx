import { buildActivityDays } from '../profile-activity'
import type { PublicProfile } from '../api'
import styles from './ProfileShowcase.module.css'

function ProfileActivityHeatmap({ activity }: { activity: PublicProfile['activity'] }) {
  const days = buildActivityDays(activity)
  const yearlySubmissions = days.reduce((total, item) => total + item.count, 0)
  return (
    <section className={styles.section} aria-labelledby="activity-title">
      <header className={styles.sectionHeader}>
        <div>
          <h2 id="activity-title">Hoạt động trong năm</h2>
          <p>{yearlySubmissions.toLocaleString('vi-VN')} lượt nộp</p>
        </div>
      </header>
      <div className={styles.heatmapScroll} tabIndex={0} aria-label="Biểu đồ hoạt động nộp bài theo ngày">
        <div className={styles.heatmap}>
          {days.map((day) => (
            <span
              className={styles.activityDay}
              data-level={day.level}
              key={day.date}
              title={`${day.date}: ${day.count} lượt nộp`}
              aria-label={`${day.date}: ${day.count} lượt nộp`}
            />
          ))}
        </div>
      </div>
      <div className={styles.heatmapLegend} aria-label="Mức độ hoạt động">
        <span>Ít</span>
        {[0, 1, 2, 3, 4].map((level) => <span className={styles.activityDay} data-level={level} key={level} aria-hidden="true" />)}
        <span>Nhiều</span>
      </div>
    </section>
  )
}

export default ProfileActivityHeatmap