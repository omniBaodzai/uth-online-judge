import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, request as publicRequest } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import FilterDropdown from '../../problems/components/FilterDropdown'
import { getGlobalSubmissions, type GlobalSubmissionPage } from '../../problems/submit/submission-service'
import SubmissionPagination from '../components/SubmissionPagination'
import SubmissionStatsChart from '../components/SubmissionStatsChart'
import SubmissionTable from '../components/SubmissionTable'
import { submissionPageSizes, verdictFilterOptions } from '../data'
import styles from './SubmissionsPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

function SubmissionsPage() {
  // Có `code` khi hiển thị theo bài tập (/problems/:code/submissions).
  const { code: problemCode } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const profileUserId = searchParams.get('userId') ?? undefined
  const { request: authRequest, accessToken, isLoading: isAuthLoading } = useAuth()
  // Trang công khai: khách dùng request không kèm token, người đã đăng nhập vẫn được đánh dấu bài của mình.
  const request = accessToken ? authRequest : publicRequest
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [verdict, setVerdict] = useState<string[]>([])
  const [language, setLanguage] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(submissionPageSizes[0])
  const [data, setData] = useState<GlobalSubmissionPage | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const selectedVerdict = verdict[0]
  const selectedLanguage = language[0]
  const requestKey = JSON.stringify([page, pageSize, debouncedQuery, selectedVerdict, selectedLanguage, problemCode, profileUserId, retryKey])
  const isLoading = settled?.key !== requestKey
  const error = settled?.key === requestKey ? settled.error : ''

  // Mỗi lần đổi bộ lọc sẽ hủy yêu cầu cũ để kết quả muộn không ghi đè kết quả mới.
  useEffect(() => {
    if (isAuthLoading) return
    const controller = new AbortController()
    getGlobalSubmissions(
      request,
      { page, pageSize, q: debouncedQuery, status: selectedVerdict, language: selectedLanguage, problemCode, userId: profileUserId },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return
        // Nếu dữ liệu thu hẹp khiến trang hiện tại không còn tồn tại, quay về trang cuối.
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.ceil(result.total / pageSize))
          return
        }
        setData(result)
        setSettled({ key: requestKey, error: '' })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error:
            requestError instanceof ApiError
              ? requestError.message
              : 'Không thể tải danh sách bài nộp. Vui lòng thử lại.',
        })
      })
    return () => controller.abort()
  }, [request, isAuthLoading, requestKey, page, pageSize, debouncedQuery, selectedVerdict, selectedLanguage, problemCode, profileUserId])

  const languageFilterOptions = useMemo(
    () => (data?.filters.languages ?? []).map((value) => ({ value, label: value })),
    [data?.filters.languages],
  )

  const hasFilters = query !== '' || verdict.length > 0 || language.length > 0

  function resetFilters() {
    setQuery('')
    setDebouncedQuery('')
    setVerdict([])
    setLanguage([])
    setPage(1)
  }

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: data?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: 'bài nộp',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  const statistics = data?.statistics

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          {problemCode ? (
            <>
              <h1>
                Danh sách bài nộp của bài{' '}
                <Link to={`/problems/${encodeURIComponent(data?.problem?.code ?? problemCode)}`} className={styles.problemLink}>
                  {data?.problem ? data.problem.title : problemCode}
                </Link>
              </h1>
            </>
          ) : (
            <>
              <h1>Danh sách bài nộp</h1>
              <p>{profileUserId ? 'Lịch sử bài nộp của coder này.' : 'Theo dõi kết quả chấm và lịch sử nộp bài của các coder.'}</p>
            </>
          )}
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
                placeholder={problemCode ? 'Tìm theo tên coder...' : 'Tìm tên bài tập, mã bài hoặc coder...'}
                maxLength={100}
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
          {error && (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Thử lại</button>
            </div>
          )}
          <SubmissionTable items={data?.items ?? []} isLoading={isLoading} hasFilters={hasFilters} hideProblem={Boolean(problemCode)} />
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </div>

        <aside className={styles.right}>
          <SubmissionStatsChart
            total={statistics?.total ?? 0}
            accepted={statistics?.accepted ?? 0}
            verdictCounts={statistics?.verdictCounts ?? {}}
          />
        </aside>
      </div>
    </main>
  )
}

export default SubmissionsPage
