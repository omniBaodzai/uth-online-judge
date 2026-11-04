import { useTranslation } from 'react-i18next'
import styles from './SubmissionPagination.module.css'

type SubmissionPaginationProps = {
  currentPage: number
  pageSize: number
  totalItems: number
  pageSizes: number[]
  label: string
  summaryLabel?: string
  additionalSummary?: string
  showPageSize?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function pageWindow(current: number, total: number): (number | 'gap-start' | 'gap-end')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'gap-start' | 'gap-end')[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(index < sorted.length / 2 ? 'gap-start' : 'gap-end')
    result.push(page)
  })
  return result
}

// Dùng chung cho phân trang phía trên và phía dưới bảng.
function SubmissionPagination({
  currentPage,
  pageSize,
  totalItems,
  pageSizes,
  label,
  summaryLabel = 'bài nộp',
  additionalSummary,
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
}: SubmissionPaginationProps) {
  const { t } = useTranslation('common')
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)
  const labelKeys: Record<string, string> = {
    'bài nộp': 'submissionItems',
    'bài nộp của tôi': 'mySubmissionItems',
    'bài tập': 'problemItems',
    'cuộc thi': 'contestItems',
    coder: 'coderItems',
    'bài giải tốt': 'bestSolutions',
    'bài tập cuộc thi': 'contestProblems',
    'bảng xếp hạng cuộc thi': 'contestRankings',
    'thí sinh': 'contestants',
    'thành viên cuộc thi': 'contestMembers',
    'thành viên': 'members',
  }
  const localizedLabel = (value: string) => {
    const key = labelKeys[value]
    return key ? t(key) : value
  }
  const localizedSummaryLabel = localizedLabel(summaryLabel)

  return (
    <div className={styles.root}>
      <p className={styles.summary}>
        {t('showingRange')} <strong>{from}–{to}</strong> {t('showingRangeOf')} <strong>{totalItems}</strong> {localizedSummaryLabel}
        {additionalSummary ? <span> · {additionalSummary}</span> : null}
      </p>
      <nav className={styles.pages} aria-label={t('pageNavigation', { label: localizedLabel(label) })}>
        <button
          type="button"
          className={styles.button}
          aria-label={t('previousPage')}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>
        {pageWindow(currentPage, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`${styles.button} ${item === currentPage ? styles.active : ''}`}
              aria-current={item === currentPage ? 'page' : undefined}
              aria-label={t('pageNumber', { page: item })}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} className={styles.gap} aria-hidden="true">…</span>
          ),
        )}
        <button
          type="button"
          className={styles.button}
          aria-label={t('nextPage')}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>
      </nav>
      {showPageSize && (
        <label className={styles.size}>
          <span>{t('itemsPerPage')}</span>
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {pageSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

export default SubmissionPagination
