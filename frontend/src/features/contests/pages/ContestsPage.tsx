import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import {
  getStudentContestPage,
  type StudentContestListItem,
  type StudentContestPage,
  type StudentContestSortField,
  type StudentContestTimeStatus,
} from '../student-contests.api'
import styles from './ContestsPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]
const SEARCH_DEBOUNCE_MS = 300

type ContestSectionConfig = {
  title: string
  status: StudentContestTimeStatus
  actionLabel: string
}

type ContestSortOption = {
  value: string
  label: string
  sort: StudentContestSortField
  order: 'asc' | 'desc'
}

const sections: ContestSectionConfig[] = [
  {
    title: 'CÁC CUỘC THI ĐANG DIỄN RA',
    status: 'ONGOING',
    actionLabel: 'Tham gia',
  },
  {
    title: 'CÁC CUỘC THI SẮP TỚI',
    status: 'UPCOMING',
    actionLabel: 'Đăng ký',
  },
  {
    title: 'CÁC CUỘC THI ĐÃ QUA',
    status: 'ENDED',
    actionLabel: 'Xem chi tiết',
  },
]

const sortOptions: ContestSortOption[] = [
  { value: 'startsAt:asc', label: 'Bắt đầu sớm nhất', sort: 'startsAt', order: 'asc' },
  { value: 'startsAt:desc', label: 'Bắt đầu muộn nhất', sort: 'startsAt', order: 'desc' },
  { value: 'endsAt:asc', label: 'Kết thúc sớm nhất', sort: 'endsAt', order: 'asc' },
  { value: 'endsAt:desc', label: 'Kết thúc muộn nhất', sort: 'endsAt', order: 'desc' },
  { value: 'title:asc', label: 'Tên A–Z', sort: 'title', order: 'asc' },
  { value: 'title:desc', label: 'Tên Z–A', sort: 'title', order: 'desc' },
  { value: 'participantCount:desc', label: 'Nhiều thành viên nhất', sort: 'participantCount', order: 'desc' },
  { value: 'participantCount:asc', label: 'Ít thành viên nhất', sort: 'participantCount', order: 'asc' },
]

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function formatContestDate(value: string): string {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date(value)).map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

function getContestDurationMinutes(contest: StudentContestListItem): number {
  return Math.max(0, Math.round(
    (new Date(contest.endsAt).getTime() - new Date(contest.startsAt).getTime()) / 60_000,
  ))
}

function ContestSection({ config }: { config: ContestSectionConfig }) {
  const {
    accessToken,
    user,
    request: authRequest,
    isLoading: isAuthLoading,
  } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sortValue, setSortValue] = useState(config.status === 'ENDED' ? 'startsAt:desc' : 'startsAt:asc')
  const [result, setResult] = useState<StudentContestPage | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const selectedSort = sortOptions.find((option) => option.value === sortValue) ?? sortOptions[0]
  const requestKey = JSON.stringify([
    config.status,
    debouncedQuery,
    page,
    pageSize,
    selectedSort.sort,
    selectedSort.order,
    user?.id ?? null,
    retryKey,
  ])
  const isLoading = isAuthLoading || settled?.key !== requestKey
  const error = settled?.key === requestKey ? settled.error : ''
  const visibleResult = settled?.key === requestKey ? result : null

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (isAuthLoading) return
    const controller = new AbortController()
    getStudentContestPage({
      page,
      pageSize,
      search: debouncedQuery,
      timeStatus: config.status,
      sort: selectedSort.sort,
      order: selectedSort.order,
    }, accessToken ? authRequest : undefined, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, Math.ceil(response.total / pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(response)
        setSettled({ key: requestKey, error: '' })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error: requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải danh sách cuộc thi. Vui lòng thử lại.',
        })
      })
    return () => controller.abort()
  }, [
    config.status,
    accessToken,
    authRequest,
    debouncedQuery,
    isAuthLoading,
    page,
    pageSize,
    requestKey,
    retryKey,
    selectedSort.order,
    selectedSort.sort,
  ])

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: visibleResult?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: config.title,
    summaryLabel: 'cuộc thi',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
  const contests = visibleResult?.items ?? []

  return (
    <section className={styles.card} aria-labelledby={`${config.status.toLocaleLowerCase('vi')}-title`}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 id={`${config.status.toLocaleLowerCase('vi')}-title`}>{config.title}</h2>
        </div>
        <span className={styles.count}>
          {visibleResult ? `${visibleResult.total} cuộc thi` : isLoading ? 'Đang tải…' : '—'}
        </span>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            aria-label={`Tìm kiếm ${config.title.toLocaleLowerCase('vi')}`}
            placeholder="Tìm theo tên cuộc thi..."
            maxLength={120}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <label className={styles.sort}>
          <span>Sắp xếp</span>
          <select
            aria-label={`Sắp xếp ${config.title.toLocaleLowerCase('vi')}`}
            value={sortValue}
            onChange={(event) => {
              setSortValue(event.target.value)
              setPage(1)
            }}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.paginationTop}>
        <SubmissionPagination {...paginationProps} showPageSize={false} />
      </div>

      {isLoading ? (
        <div className={styles.empty} role="status" aria-live="polite">
          <strong>Đang tải cuộc thi…</strong>
        </div>
      ) : error ? (
        <div className={styles.empty} role="alert">
          <strong>Không thể tải cuộc thi</strong>
          <p>{error}</p>
          <button type="button" className={styles.retryButton} onClick={() => setRetryKey((key) => key + 1)}>
            Thử lại
          </button>
        </div>
      ) : contests.length === 0 ? (
        <div className={styles.empty}>
          <strong>{query ? 'Không tìm thấy cuộc thi phù hợp' : 'Chưa có cuộc thi nào'}</strong>
          <p>{query ? 'Hãy thử thay đổi từ khóa tìm kiếm.' : 'Các cuộc thi sẽ xuất hiện tại đây.'}</p>
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label={config.title} tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Tên cuộc thi</th>
                <th scope="col" className={styles.participantColumn}>Thành viên</th>
                <th scope="col" className={styles.actionColumn}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((contest) => (
                <tr key={contest.id}>
                  <td>
                    <div className={styles.contestDetails}>
                      <Link
                        className={styles.contestTitle}
                        to={`/contests/${encodeURIComponent(contest.slug)}`}
                      >
                        {contest.title}
                      </Link>
                      <div className={styles.metadata}>
                        <span><b>Bắt đầu:</b> {formatContestDate(contest.startsAt)}</span>
                        <span><b>Kết thúc:</b> {formatContestDate(contest.endsAt)}</span>
                        <span><b>Thời gian thi:</b> {getContestDurationMinutes(contest)} phút</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.participantCell}>
                    <span aria-label={`${contest.participantCount} thành viên đã đăng ký`}>
                      {contest.participantCount.toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td className={styles.actionCell}>
                    <Link
                      className={styles.actionButton}
                      to={`/contests/${encodeURIComponent(contest.slug)}`}
                    >
                      {contest.isRegistered ? (
                        <>
                          <Check size={16} aria-hidden="true" />
                          <span>Đã đăng ký</span>
                        </>
                      ) : config.actionLabel}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.paginationBottom}>
        <SubmissionPagination {...paginationProps} />
      </div>
    </section>
  )
}

function ContestsPage() {
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Danh sách các cuộc thi</h1>
        <div className={styles.sections}>
          {sections.map((config) => <ContestSection key={config.status} config={config} />)}
        </div>
      </div>
    </main>
  )
}

export default ContestsPage
