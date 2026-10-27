import styles from './RatingChart.module.css'

type Props = { history: { contestName: string; date: string; rating: number }[] }

const W = 640
const H = 220
const PAD = { top: 16, right: 20, bottom: 30, left: 44 }

function RatingChart({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>Chưa có lịch sử rating</strong>
        <p>Biểu đồ sẽ xuất hiện sau khi bạn tham gia cuộc thi đầu tiên.</p>
      </div>
    )
  }

  const ratings = history.map((item) => item.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const span = Math.max(1, max - min)
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const x = (i: number) =>
    PAD.left + (history.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (history.length - 1))
  const y = (value: number) => PAD.top + ((hi - value) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const points = history.map((item, i) => `${x(i)},${y(item.rating)}`).join(' ')
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v))

  return (
    <>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ lịch sử rating">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className={styles.grid} />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className={styles.axis}>
              {tick}
            </text>
          </g>
        ))}
        <polyline points={points} className={styles.line} />
        {history.map((item, i) => (
          <circle key={`${item.date}-${i}`} cx={x(i)} cy={y(item.rating)} r="4" className={styles.dot}>
            <title>{`${item.contestName} · ${new Date(item.date).toLocaleDateString('vi-VN')} · ${item.rating}`}</title>
          </circle>
        ))}
        <text x={x(0)} y={H - 8} textAnchor="start" className={styles.axis}>
          {new Date(history[0].date).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
        </text>
        <text x={x(history.length - 1)} y={H - 8} textAnchor="end" className={styles.axis}>
          {new Date(history[history.length - 1].date).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}
        </text>
      </svg>
      <dl className={styles.summary}>
        <div><dt>Rating thấp nhất</dt><dd>{min}</dd></div>
        <div><dt>Rating cao nhất</dt><dd>{max}</dd></div>
        <div><dt>Khoảng biến động</dt><dd>{max - min}</dd></div>
      </dl>
    </>
  )
}

export default RatingChart
