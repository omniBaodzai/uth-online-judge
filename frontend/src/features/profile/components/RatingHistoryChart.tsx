import type { RatingPoint } from '../data'
import styles from './RatingHistoryChart.module.css'

type RatingHistoryChartProps = {
  points: RatingPoint[]
  currentRating: number
  minRating: number
  maxRating: number
}

function RatingHistoryChart({ points, currentRating, minRating, maxRating }: RatingHistoryChartProps) {
  const width = 680
  const height = 220
  const left = 42
  const right = 14
  const top = 16
  const bottom = 34
  const range = Math.max(maxRating - minRating, 1)
  const chartMin = Math.floor((minRating - 100) / 100) * 100
  const chartMax = Math.ceil((maxRating + 100) / 100) * 100
  const chartRange = Math.max(chartMax - chartMin, 1)
  const coordinates = points.map((point, index) => ({
    x: left + index / Math.max(points.length - 1, 1) * (width - left - right),
    y: top + (chartMax - point.rating) / chartRange * (height - top - bottom),
    rating: point.rating,
  }))
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`
  const gridValues = [chartMin, chartMin + chartRange / 3, chartMin + chartRange * 2 / 3, chartMax]

  return (
    <section className={styles.panel} aria-labelledby="rating-history-title">
      <div className={styles.panelHeader}>
        <div><p>TIẾN TRÌNH</p><h2 id="rating-history-title">Lịch sử rating</h2></div>
        <span>Hiện tại <strong>{currentRating}</strong></span>
      </div>
      <div className={styles.chartScroll}>
        <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Rating thay đổi từ ${minRating} đến ${maxRating}`}>
          <defs>
            <linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#159b8f" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#159b8f" stopOpacity="0.015" />
            </linearGradient>
          </defs>
          {gridValues.map((value) => {
            const y = top + (chartMax - value) / chartRange * (height - top - bottom)
            return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className={styles.gridLine} /><text x={left - 8} y={y + 3} className={styles.axisLabel} textAnchor="end">{Math.round(value)}</text></g>
          })}
          <polygon points={area} fill="url(#rating-fill)" />
          <polyline points={line} className={styles.ratingLine} />
          {coordinates.map((point, index) => <circle cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} className={styles.ratingPoint} key={`${points[index].label}-${point.rating}`} />)}
          {points.map((point, index) => index % 2 === 0 && <text key={point.label} x={coordinates[index].x} y={height - 10} className={styles.axisLabel} textAnchor="middle">{point.label}</text>)}
        </svg>
      </div>
      <div className={styles.ratingSummary}><span>Rating thấp nhất <strong>{minRating}</strong></span><span>Rating cao nhất <strong>{maxRating}</strong></span><span>Khoảng biến động <strong>{range}</strong></span></div>
    </section>
  )
}

export default RatingHistoryChart