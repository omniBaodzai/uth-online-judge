import { useMemo, useState, type FormEvent } from 'react'
import Pagination from '../../../components/ui/Pagination'
import SiteHeader from '../../../components/layout/SiteHeader'
import SubmissionFilter from '../components/SubmissionFilter'
import SubmissionStats from '../components/SubmissionStats'
import SubmissionTable from '../components/SubmissionTable'
import {
  defaultSubmissionFilters,
  globalSubmissionTotal,
  submissionLanguages,
  submissionOrganizations,
  submissionPageSize,
  submissionStatuses,
  submissions,
  type SubmissionFilters,
} from '../data'
import styles from './SubmissionsPage.module.css'

function SubmissionsPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const problemId = searchParams.get('problemId')?.toUpperCase() ?? ''
  const username = searchParams.get('username')?.toLocaleLowerCase('vi') ?? ''
  const bestFirst = searchParams.get('sort') === 'best'
  const [draftFilters, setDraftFilters] = useState<SubmissionFilters>(defaultSubmissionFilters)
  const [filters, setFilters] = useState<SubmissionFilters>(defaultSubmissionFilters)
  const [currentPage, setCurrentPage] = useState(1)

  const filteredSubmissions = useMemo(() => submissions.filter((submission) => {
    const matchesProblem = !problemId || submission.problemId === problemId
    const matchesUsername = !username || submission.username.toLocaleLowerCase('vi') === username
    const matchesStatus = filters.status === 'Tất cả trạng thái' || submission.status === filters.status
    const matchesLanguage = filters.language === 'Tất cả ngôn ngữ' || submission.language === filters.language
    const matchesOrganization = filters.organization === 'Tất cả tổ chức'
      || submission.organization === filters.organization
    return matchesProblem && matchesUsername && matchesStatus && matchesLanguage && matchesOrganization
  }).sort((first, second) => {
    if (!bestFirst) return 0
    if (first.status === 'AC' && second.status !== 'AC') return -1
    if (first.status !== 'AC' && second.status === 'AC') return 1
    return (first.runtimeMs ?? Number.MAX_SAFE_INTEGER) - (second.runtimeMs ?? Number.MAX_SAFE_INTEGER)
  }), [bestFirst, filters, problemId, username])

  const totalPages = Math.ceil(filteredSubmissions.length / submissionPageSize)
  const visibleSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * submissionPageSize,
    currentPage * submissionPageSize,
  )
  const firstResult = filteredSubmissions.length === 0 ? 0 : (currentPage - 1) * submissionPageSize + 1
  const lastResult = Math.min(currentPage * submissionPageSize, filteredSubmissions.length)

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(draftFilters)
    setCurrentPage(1)
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>THEO DÕI KẾT QUẢ</p>
            <h1>Bảng chấm bài</h1>
            <p className={styles.introText}>Cập nhật các lượt nộp và kết quả chấm trên UTH Online Judge.</p>
          </div>
          <div className={styles.totalBadge}>
            <span className={styles.liveDot} />
            <span>Hệ thống đang hoạt động</span>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.listPanel} aria-label="Danh sách bài nộp">
            <div className={styles.listHeader}>
              <div>
                <h2>{bestFirst ? 'Bài nộp tốt nhất' : username ? `Bài nộp của ${username}` : problemId ? `Bài nộp ${problemId}` : 'Bài nộp gần đây'}</h2>
                <p>Hiển thị {firstResult}–{lastResult} trong {filteredSubmissions.length} kết quả mẫu</p>
              </div>
              <div className={styles.totalInline}>
                <span>Tổng lượt nộp</span>
                <strong>{globalSubmissionTotal.toLocaleString('vi-VN')}</strong>
              </div>
            </div>
            <div className={styles.paginationTop}>
              <span className={styles.pageHint}>Trang {currentPage} / {Math.max(totalPages, 1)}</span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="bài nộp"
              />
            </div>
            <SubmissionTable submissions={visibleSubmissions} />
            <div className={styles.listFooter}>
              <span>{filteredSubmissions.length} lượt nộp trong dữ liệu mẫu</span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="bài nộp"
              />
            </div>
          </section>

          <aside className={styles.sidebar} aria-label="Bộ lọc và thống kê bài nộp">
            <SubmissionFilter
              values={draftFilters}
              statuses={submissionStatuses}
              languages={submissionLanguages}
              organizations={submissionOrganizations}
              onChange={setDraftFilters}
              onSubmit={applyFilters}
            />
            <SubmissionStats submissions={submissions} />
          </aside>
        </div>
      </main>
    </div>
  )
}

export default SubmissionsPage