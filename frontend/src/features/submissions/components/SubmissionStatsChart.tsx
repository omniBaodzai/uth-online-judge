import {
  getSubmissionVerdictDistribution,
  getSubmissionVerdictLegend,
  submissionVerdictTranslationKeys,
} from '../data/submission-verdicts'
import { useTranslation } from 'react-i18next'
import styles from './SubmissionStatsChart.module.css'

type SubmissionStatsChartProps = {
  total: number
  accepted: number
  verdictCounts: Record<string, number>
  subtitle?: string
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Biểu đồ vành khuyên bằng SVG, không cần thêm thư viện biểu đồ.
function SubmissionStatsChart({ total, accepted, verdictCounts, subtitle }: SubmissionStatsChartProps) {
  const { t } = useTranslation('pages')
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
      <h2 id="stats-title" className={styles.heading}>{t('submissionStatsTitle')}</h2>
      <div className={styles.body}>
        {subtitle && <p className={styles.desc}>{subtitle}</p>}

        <div className={styles.chartWrap}>
          <svg
            viewBox="0 0 140 140"
            className={styles.chart}
            role="img"
            aria-label={t('submissionChartLabel', { total })}
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
            <span>{t('submissionCount')}</span>
          </div>
        </div>

        <dl className={styles.summary}>
          <div><dt>{t('total')}</dt><dd>{total}</dd></div>
          <div><dt>AC</dt><dd>{accepted}</dd></div>
          <div><dt>{t('acceptedRate')}</dt><dd>{acRate.toFixed(1)}%</dd></div>
        </dl>

        {total === 0 ? (
          <p className={styles.empty}>{t('noStatsData')}</p>
        ) : (
          <ul className={styles.legend}>
            {legend.map((item) => (
              <li key={item.status}>
                <span className={styles.dot} style={{ background: item.color }} aria-hidden="true" />
                <span className={styles.name}>
                  <strong>{item.abbr}</strong> {submissionVerdictTranslationKeys[item.status] ? t(submissionVerdictTranslationKeys[item.status]) : item.label}
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
