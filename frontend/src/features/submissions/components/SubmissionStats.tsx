import type { Submission, SubmissionStatus } from '../data'
import { globalSubmissionTotal, submissionStatuses, statusDescriptions } from '../data'
import styles from './SubmissionStats.module.css'

type SubmissionStatsProps = {
  submissions: Submission[]
}

const statusColors: Record<SubmissionStatus, string> = {
  AC: '#2ca77c',
  WA: '#e36a5b',
  TLE: '#e7a63d',
  CE: '#846bb7',
  RE: '#b56a9b',
  MLE: '#5e9bc1',
}

function SubmissionStats({ submissions }: SubmissionStatsProps) {
  const counts = Object.fromEntries(submissionStatuses.map((status) => [
    status,
    submissions.filter((submission) => submission.status === status).length,
  ])) as Record<SubmissionStatus, number>
  const total = submissions.length
  let offset = 0
  const chartSegments = submissionStatuses.map((status) => {
    const start = offset
    offset += total === 0 ? 0 : counts[status] / total * 100
    return `${statusColors[status]} ${start}% ${offset}%`
  }).join(', ')

  return (
    <section className={styles.statsPanel} aria-labelledby="submission-stats-title">
      <div className={styles.statsHeading}>
        <div>
          <p>TOÀN NỀN TẢNG</p>
          <h2 id="submission-stats-title">Thống kê bài nộp</h2>
        </div>
        <span className={styles.statsMark} aria-hidden="true">◷</span>
      </div>

      <div className={styles.totalBlock}>
        <span>Tổng lượt nộp</span>
        <strong>{globalSubmissionTotal.toLocaleString('vi-VN')}</strong>
        <small>Dữ liệu toàn hệ thống</small>
      </div>

      <div className={styles.chartArea}>
        <div
          className={styles.donut}
          style={{ background: total ? `conic-gradient(${chartSegments})` : '#e8eeee' }}
          role="img"
          aria-label={`Phân bố ${total} bài nộp mẫu theo trạng thái`}
        >
          <div className={styles.donutCenter}>
            <strong>{total}</strong>
            <span>bài gần đây</span>
          </div>
        </div>
        <div className={styles.legend}>
          {submissionStatuses.map((status) => (
            <div className={styles.legendItem} key={status}>
              <span className={styles.legendDot} style={{ background: statusColors[status] }} />
              <span className={styles.legendLabel}>{statusDescriptions[status]}</span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.successRate}>
        <span>Tỷ lệ chấp nhận</span>
        <strong>{total ? Math.round(counts.AC / total * 100) : 0}%</strong>
      </div>
    </section>
  )
}

export default SubmissionStats