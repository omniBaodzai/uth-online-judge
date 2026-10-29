import {
  getSubmissionVerdictDistribution,
  getSubmissionVerdictLegend,
} from '../data/submission-verdicts'
import styles from './SubmissionStatsChart.module.css'

type SubmissionStatsChartProps = {
  total: number
  accepted: number
  verdictCounts: Record<string, number>
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Biểu đồ vành khuyên bằng SVG, không cần thêm thư viện biểu đồ.
function SubmissionStatsChart({ total, accepted, verdictCounts }: SubmissionStatsChartProps) {
  const acRate = total === 0 ? 0 : (accepted / total) * 100
  const legend = getSubmissionVerdictLegend(verdictCounts, total)

  const segments = getSubmissionVerdictDistribution(verdictCounts, total).map((item, index, items) => {
    const before = items.slice(0, index).reduce((sum, previous) => sum + previous.count, 0)
    return {
      ...item,
      length: (item.count / total) * CIRCUMFERENCE,
      offset: (before / total) * CIRCUMFERENCE,
    }
  })

  return (
    <section className={styles.card} aria-labelledby="stats-title">
      <h2 id="stats-title" className={styles.heading}>Thống kê kết quả chấm</h2>
      <div className={styles.body}>
        <p className={styles.desc}></p>

        <div className={styles.chartWrap}>
          <svg
            viewBox="0 0 140 140"
            className={styles.chart}
            role="img"
            aria-label={`Biểu đồ kết quả chấm, tổng ${total} bài nộp`}
          >
            <circle cx="70" cy="70" r={RADIUS} className={styles.track} />
            {segments.map((segment) => (
              <circle
                key={segment.status}
                cx="70"
                cy="70"
                r={RADIUS}
                className={styles.segment}
                stroke={segment.color}
                strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
                strokeDashoffset={-segment.offset}
              >
                <title>{`${segment.abbr}: ${segment.count} (${segment.percentage.toFixed(1)}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className={styles.center}>
            <strong>{total}</strong>
            <span>bài nộp</span>
          </div>
        </div>

        <dl className={styles.summary}>
          <div><dt>Tổng</dt><dd>{total}</dd></div>
          <div><dt>AC</dt><dd>{accepted}</dd></div>
          <div><dt>Tỷ lệ AC</dt><dd>{acRate.toFixed(1)}%</dd></div>
        </dl>

        {total === 0 ? (
          <p className={styles.empty}>Chưa có dữ liệu để thống kê.</p>
        ) : (
          <ul className={styles.legend}>
            {legend.map((item) => (
              <li key={item.status}>
                <span className={styles.dot} style={{ background: item.color }} aria-hidden="true" />
                <span className={styles.name}>
                  <strong>{item.abbr}</strong> {item.label}
                </span>
                <span className={styles.value}>
                  {item.count} · {item.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SubmissionStatsChart
