import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatExecutionTime, formatMemory, getVerdictBadge, type Submission } from '../data'
import { submissionVerdictTranslationKeys } from '../data/submission-verdicts'
import styles from './SubmissionTable.module.css'

type SubmissionTableProps = {
  items: Submission[]
  isLoading?: boolean
  hasFilters: boolean
  showRank?: boolean
  emptyTitle?: string
  emptyDescription?: string
  contestIdentifier?: string
  // Trang theo từng bài tập đã nêu tên bài ở tiêu đề nên không lặp lại cột này.
  hideProblem?: boolean
}

function SubmissionTable({
  items,
  isLoading = false,
  hasFilters,
  hideProblem = false,
  showRank = false,
  emptyTitle,
  emptyDescription,
  contestIdentifier,
}: SubmissionTableProps) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const dateFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  if (isLoading) {
    return (
      <ul className={styles.skeletons} aria-label={t('loadingData')} aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>{emptyTitle ?? (hasFilters ? t('noMatchingSubmissions') : t('noSubmissions'))}</strong>
        <p>{emptyDescription ?? (hasFilters ? t('submissionSearchHint') : t('newSubmissionsHint'))}</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap} tabIndex={0} role="region" aria-label={t('submissionTableLabel')}>
      <table className={styles.table}>
        <thead>
          <tr>
            {showRank && <th scope="col">Thứ hạng</th>}
            <th scope="col">Kết quả</th>
            <th scope="col">{t('submittedAt')}</th>
            <th scope="col">{t('coder')}</th>
            {!hideProblem && <th scope="col">{t('problemName')}</th>}
            <th scope="col">{t('language', { ns: 'common' })}</th>
            <th scope="col" className={styles.num}>{t('runtime')}</th>
            <th scope="col" className={styles.num}>{t('memory')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const meta = getVerdictBadge(item.status)
            const verdictTranslationKey = submissionVerdictTranslationKeys[item.status]
            const verdictLabel = verdictTranslationKey
              ? t(verdictTranslationKey)
              : meta.name
            const date = new Date(item.submittedAt)
            const validDate = !Number.isNaN(date.getTime())
            const badgeStyle = { color: meta.color, background: meta.background }
            return (
              <tr key={item.id}>
                {showRank && (
                  <td className={styles.rank}>
                    {item.rank === 1 && <Crown size={16} aria-hidden="true" />}
                    <span>{item.rank ?? '—'}</span>
                  </td>
                )}
                <td>
                  {/* Chỉ chủ bài nộp mới xem được chi tiết, nên người khác chỉ thấy nhãn kết quả. */}
                  {item.canViewDetails ? (
                    <Link
                      className={`${styles.badge} ${styles.badgeLink}`}
                      style={badgeStyle}
                      to={`/submissions/${encodeURIComponent(item.id)}`}
                      title={`${verdictLabel} — ${t('viewSubmissionDetails')}`}
                    >
                      {meta.abbr}
                    </Link>
                  ) : (
                    <span className={styles.badge} style={badgeStyle} title={verdictLabel}>
                      {meta.abbr}
                    </span>
                  )}
                </td>
                <td className={styles.time}>
                  <span>{validDate ? dateFormat.format(date) : '—'}</span>
                  <span>{validDate ? timeFormat.format(date) : ''}</span>
                </td>
                {/* Chưa có route hồ sơ công khai nên chưa gắn liên kết cho coder. */}
                <td className={styles.coder}>{item.username ?? t('anonymous')}</td>
                {!hideProblem && (
                  <td>
                    <Link
                      className={styles.problem}
                      to={contestIdentifier
                        ? `/contests/${encodeURIComponent(contestIdentifier)}/problems/${encodeURIComponent(item.problemCode)}`
                        : `/problems/${encodeURIComponent(item.problemCode)}`}
                    >
                      {item.problemTitle}
                    </Link>
                    <span className={styles.code}>{item.problemCode}</span>
                  </td>
                )}
                <td className={styles.lang}>{item.language}</td>
                <td className={styles.num}>{formatExecutionTime(item.executionTimeMs)}</td>
                <td className={styles.num}>{formatMemory(item.memoryUsedKb)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default SubmissionTable
