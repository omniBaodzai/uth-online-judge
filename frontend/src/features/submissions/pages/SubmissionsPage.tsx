import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Pagination from '../../../components/ui/Pagination'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import { problems } from '../../problems/data'
import { isJudgingFinished, languageNameById, listSubmissions, type SubmissionResult } from '../api'
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
  type Submission,
} from '../data'
import styles from './SubmissionsPage.module.css'

function toRow(item: SubmissionResult): Submission {
  const problem = problems.find((entry) => entry.id === item.problemCode.toUpperCase())
  const created = new Date(item.createdAt)
  return {
    id: item.id,
    problemId: item.problemCode,
    problemTitle: problem?.title ?? item.problemCode,
    tags: problem?.tags ?? [],
    status: item.status as Submission['status'],
    passedTests: item.passedTests,
    totalTests: item.totalTests,
    language: languageNameById[item.languageId] ?? `Judge0 #${item.languageId}`,
    username: item.username ?? 'ẩn danh',
    submittedAt: created.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
    dateTime: item.createdAt,
    runtimeMs: item.executionTime === null ? null : Math.round(item.executionTime * 1000),
    memoryMb: item.memoryUsed === null ? null : item.memoryUsed / 1024,
    organization: 'UTH Online Judge',
    detailHref: `/submissions/${item.id}`,
  }
}

function SubmissionsPage() {
  const { request, isAuthenticated, isLoading } = useAuth()
  const requestRef = useRef(request)
  const [liveSubmissions, setLiveSubmissions] = useState<Submission[]>([])
  const searchParams = new URLSearchParams(window.location.search)
  const problemId = searchParams.get('problemId')?.toUpperCase() ?? ''
  const username = searchParams.get('username')?.toLocaleLowerCase('vi') ?? ''
  const bestFirst = searchParams.get('sort') === 'best'
  const [draftFilters, setDraftFilters] = useState<SubmissionFilters>(defaultSubmissionFilters)
  const [filters, setFilters] = useState<SubmissionFilters>(defaultSubmissionFilters)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    let cancelled = false
    listSubmissions(requestRef.current)
      .then((result) => {
        if (!cancelled) setLiveSubmissions(result.items.filter((item) => isJudgingFinished(item.status)).map(toRow))
      })
      .catch(() => {
        if (!cancelled) setLiveSubmissions([])
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isLoading])

  const allSubmissions = useMemo(() => [...liveSubmissions, ...submissions], [liveSubmissions])

  const filteredSubmissions = useMemo(() => allSubmissions.filter((submission) => {
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
  }), [allSubmissions, bestFirst, filters, problemId, username])

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
              languages={[...new Set([...submissionLanguages, ...liveSubmissions.map((item) => item.language)])].sort()}
              organizations={submissionOrganizations}
              onChange={setDraftFilters}
              onSubmit={applyFilters}
            />
            <SubmissionStats submissions={allSubmissions} />
          </aside>
        </div>
      </main>
    </div>
  )
}

export default SubmissionsPage