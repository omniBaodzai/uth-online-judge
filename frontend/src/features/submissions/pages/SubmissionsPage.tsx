import { useMemo, useState } from 'react'
import FilterDropdown from '../../problems/components/FilterDropdown'
import SubmissionPagination from '../components/SubmissionPagination'
import SubmissionStatsChart from '../components/SubmissionStatsChart'
import SubmissionTable from '../components/SubmissionTable'
import {
  countVerdicts,
  languageOptions,
  sampleSubmissions,
  submissionPageSizes,
  verdictMeta,
  verdictOptions,
  type Submission,
} from '../data'
import styles from './SubmissionsPage.module.css'

// Đổi giá trị để xem trước trạng thái tải khi chưa có API.
const isLoading = false
const submissions: Submission[] = sampleSubmissions

const verdictFilterOptions = verdictOptions.map((value) => ({ value, label: `${value} — ${verdictMeta[value].name}` }))
const languageFilterOptions = languageOptions.map((value) => ({ value, label: value }))

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()
}

function SubmissionsPage() {
  const [query, setQuery] = useState('')
  const [verdict, setVerdict] = useState<string[]>([])
  const [language, setLanguage] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(submissionPageSizes[0])

  const stats = useMemo(() => countVerdicts(submissions), [])

  const filtered = useMemo(() => {
    const keyword = normalize(query.trim())
    return submissions.filter((item) => {
      if (verdict.length && item.verdict !== verdict[0]) return false
      if (language.length && item.language !== language[0]) return false
      if (!keyword) return true
      return normalize(`${item.problemTitle} ${item.problemCode} ${item.coder}`).includes(keyword)
    })
  }, [query, verdict, language])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasFilters = query !== '' || verdict.length > 0 || language.length > 0

  function resetFilters() {
    setQuery('')
    setVerdict([])
    setLanguage([])
    setPage(1)
  }

  const paginationProps = {
    currentPage,
    pageSize,
    totalItems: filtered.length,
    pageSizes: submissionPageSizes,
    label: 'bài nộp',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>Danh sách bài nộp</h1>
          <p>Theo dõi kết quả chấm và lịch sử nộp bài của các coder.</p>
        </header>

        <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
            <div className={styles.search}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                type="search"
                aria-label="Tìm bài nộp"
                placeholder="Tìm tên bài tập, mã bài hoặc coder..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <FilterDropdown
              label="Kết quả"
              options={verdictFilterOptions}
              selected={verdict}
              onChange={(value) => {
                setVerdict(value)
                setPage(1)
              }}
            />
            <FilterDropdown
              label="Ngôn ngữ"
              options={languageFilterOptions}
              selected={language}
              onChange={(value) => {
                setLanguage(value)
                setPage(1)
              }}
            />
            <button type="button" className={styles.reset} onClick={resetFilters} disabled={!hasFilters}>
              Đặt lại
            </button>
          </form>

          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} showPageSize={false} />
          </div>

        <div className={styles.card}>
          <SubmissionTable items={pageItems} isLoading={isLoading} hasFilters={hasFilters} />
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </div>

        <aside className={styles.right}>
          <SubmissionStatsChart counts={stats} />
        </aside>
      </div>
    </main>
  )
}

export default SubmissionsPage
