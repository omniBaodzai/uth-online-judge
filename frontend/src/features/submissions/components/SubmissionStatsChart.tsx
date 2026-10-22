import { verdictMeta, verdictOptions, type SubmissionVerdict } from '../data'
import styles from './SubmissionStatsChart.module.css'

type SubmissionStatsChartProps = {
  counts: Record<SubmissionVerdict, number>
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Biểu đồ vành khuyên bằng SVG, không cần thêm thư viện biểu đồ.
function SubmissionStatsChart({ counts }: SubmissionStatsChartProps) {
  const total = verdictOptions.reduce((sum, key) => sum + counts[key], 0)
  const acRate = total === 0 ? 0 : (counts.AC / total) * 100

  const segments = verdictOptions
    .filter((key) => counts[key] > 0)
    .map((key, index, keys) => {
      const before = keys.slice(0, index).reduce((sum, k) => sum + counts[k], 0)
      return {
        key,
        length: (counts[key] / total) * CIRCUMFERENCE,
        offset: (before / total) * CIRCUMFERENCE,
      }
    })

  return (
    <section className={styles.card} aria-labelledby="stats-title">
      <h2 id="stats-title" className={styles.heading}>Thống kê kết quả chấm</h2>
      <div className={styles.body}>
        <p className={styles.desc}>Tỷ lệ các kết quả trên tổng số bài nộp</p>

        <div className={styles.chartWrap}>
          <svg
            viewBox="0 0 140 140"
            className={styles.chart}
            role="img"
            aria-label={`Biểu đồ kết quả chấm, tổng ${total} bài nộp`}
          >
            <circle cx="70" cy="70" r={RADIUS} className={styles.track} />
            {segments.map(({ key, length, offset: start }) => (
              <circle
                key={key}
                cx="70"
                cy="70"
                r={RADIUS}
                className={styles.segment}
                stroke={verdictMeta[key].chart}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-start}
              >
                <title>{`${key}: ${counts[key]} (${((counts[key] / total) * 100).toFixed(1)}%)`}</title>
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
          <div><dt>AC</dt><dd>{counts.AC}</dd></div>
          <div><dt>Tỷ lệ AC</dt><dd>{acRate.toFixed(1)}%</dd></div>
        </dl>

        {total === 0 ? (
          <p className={styles.empty}>Chưa có dữ liệu để thống kê.</p>
        ) : (
          <ul className={styles.legend}>
            {verdictOptions.map((key) => (
              <li key={key}>
                <span className={styles.dot} style={{ background: verdictMeta[key].chart }} aria-hidden="true" />
                <span className={styles.name}>
                  <strong>{key}</strong> {verdictMeta[key].name}
                </span>
                <span className={styles.value}>
                  {counts[key]} · {((counts[key] / total) * 100).toFixed(1)}%
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
