import type { ActivityDay } from '../data'
import styles from './ContributionHeatmap.module.css'

type ContributionHeatmapProps = {
  days: ActivityDay[]
}

function ContributionHeatmap({ days }: ContributionHeatmapProps) {
  const totalSubmissions = days.reduce((total, day) => total + day.count, 0)
  const activeDays = days.filter((day) => day.count > 0).length

  return (
    <section className={styles.panel} aria-labelledby="activity-title">
      <div className={styles.panelHeader}>
        <div><p>ĐÓNG GÓP</p><h2 id="activity-title">Hoạt động trong năm</h2></div>
        <strong>{totalSubmissions.toLocaleString('vi-VN')} lượt nộp</strong>
      </div>
      <div className={styles.heatmapScroll}>
        <div className={styles.monthLabels} aria-hidden="true">
          {['T11', 'T12', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'].map((month) => <span key={month}>{month}</span>)}
        </div>
        <div className={styles.heatmap} role="img" aria-label={`${activeDays} ngày hoạt động trong 52 tuần qua`}>
          {days.map((day) => (
            <span
              className={`${styles.day} ${styles[`level${day.level}`]}`}
              key={day.date}
              title={`${day.date}: ${day.count} lượt nộp`}
            />
          ))}
        </div>
      </div>
      <div className={styles.heatmapFooter}>
        <span>{activeDays} ngày có hoạt động</span>
        <div className={styles.legend}><span>Ít</span>{[0, 1, 2, 3, 4].map((level) => <i className={styles[`level${level}`]} key={level} />)}<span>Nhiều</span></div>
      </div>
    </section>
  )
}

export default ContributionHeatmap