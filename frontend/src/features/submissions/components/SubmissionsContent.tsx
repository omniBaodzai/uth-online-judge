import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, request as publicRequest } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import FilterDropdown from '../../problems/components/FilterDropdown'
import {
  getGlobalSubmissions,
  type GlobalSubmissionPage,
} from '../../problems/submit/submission-service'
import {
  getStudentContestSubmissions,
  type StudentContestRequester,
  type StudentContestSubmissionsPage,
} from '../../contests/student-contests.api'
import SubmissionPagination from './SubmissionPagination'
import SubmissionStatsChart from './SubmissionStatsChart'
import SubmissionTable from './SubmissionTable'
import { submissionPageSizes, verdictFilterOptions } from '../data'
import styles from '../pages/SubmissionsPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

type SubmissionsContentProps = {
  contestIdentifier?: string
  requester?: StudentContestRequester
  problemCode?: string
  profileUserId?: string
}

function SubmissionsContent({
  contestIdentifier,
  requester: contestRequester,
  problemCode,
  profileUserId,
}: SubmissionsContentProps) {
  const isContestMode = Boolean(contestIdentifier)
  const { request: authRequest, accessToken, isLoading: isAuthLoading } = useAuth()
  const request = contestRequester ?? (accessToken ? authRequest : publicRequest)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [verdict, setVerdict] = useState<string[]>([])
  const [language, setLanguage] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10)
  const [loadedData, setLoadedData] = useState<{
    key: string
    value: GlobalSubmissionPage | StudentContestSubmissionsPage
  } | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const selectedVerdict = verdict[0]
  const selectedLanguage = language[0]
  const requestKey = JSON.stringify([
    contestIdentifier,
    page,
    pageSize,
    debouncedQuery,
    selectedVerdict,
    selectedLanguage,
    problemCode,
    profileUserId,
    retryKey,
  ])
  const data = loadedData?.key === requestKey ? loadedData.value : null
  const isLoading = isAuthLoading || settled?.key !== requestKey
  const error = settled?.key === requestKey ? settled.error : ''

  useEffect(() => {
    if (isAuthLoading) return
    const controller = new AbortController()
    const operation = contestIdentifier
      ? getStudentContestSubmissions(
        request,
        contestIdentifier,
        {
          page,
          pageSize,
          search: debouncedQuery,
          status: selectedVerdict,
          language: selectedLanguage,
        },
        controller.signal,
      )
      : getGlobalSubmissions(
        request,
        {
          page,
          pageSize,
          q: debouncedQuery,
          status: selectedVerdict,
          language: selectedLanguage,
          problemCode,
          userId: profileUserId,
        },
        controller.signal,
      )
    operation
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.ceil(result.total / pageSize))
          return
        }
        setLoadedData({ key: requestKey, value: result })
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
  }, [
    contestIdentifier,
    request,
    isAuthLoading,
    requestKey,
    page,
    pageSize,
    debouncedQuery,
    selectedVerdict,
    selectedLanguage,
    problemCode,
    profileUserId,
  ])

  const languageFilterOptions = useMemo(() => {
    const languages = loadedData?.value.filters.languages ?? []
    return languages.map((value) => ({ value, label: value }))
  }, [loadedData?.value.filters.languages])

  const hasFilters = query !== '' || verdict.length > 0 || language.length > 0
  const totalItems = data?.total ?? 0
  const items = data?.items ?? []
  const statistics = data?.statistics
  const globalProblem = data && 'problem' in data ? data.problem : null

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
    totalItems,
    pageSizes: submissionPageSizes,
    label: 'bài nộp',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      if (size === 10 || size === 20 || size === 50) setPageSize(size)
      setPage(1)
    },
  }

  const content = (
    <div className={`${styles.grid} ${isContestMode ? styles.embeddedGrid : ''}`}>
      {!isContestMode && (
        <header className={styles.header}>
          {problemCode ? (
            <h1>
              Danh sách bài nộp của bài{' '}
              <Link to={`/problems/${encodeURIComponent(globalProblem?.code ?? problemCode)}`} className={styles.problemLink}>
                {globalProblem ? globalProblem.title : problemCode}
              </Link>
            </h1>
          ) : (
            <>
              <h1>Danh sách bài nộp</h1>
              <p>{profileUserId ? '' : ''}</p>
            </>
          )}
        </header>
      )}

      <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
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
            onChange={(event) => {
              setQuery(event.target.value)
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

      <div className={styles.card}>
        <div className={styles.topPagination}>
          <SubmissionPagination {...paginationProps} showPageSize={false} />
        </div>
        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Thử lại</button>
          </div>
        )}
        {!error && (
          <SubmissionTable
            items={items}
            isLoading={isLoading}
            hasFilters={hasFilters}
            hideProblem={Boolean(problemCode)}
            contestIdentifier={contestIdentifier}
            emptyTitle={isContestMode && !hasFilters ? 'Chưa có bài nộp' : undefined}
            emptyDescription={isContestMode && !hasFilters ? 'Bài nộp trong cuộc thi sẽ xuất hiện tại đây.' : undefined}
          />
        )}
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
  )

  return isContestMode ? content : <main className={styles.main} id="main-content">{content}</main>
}

export default SubmissionsContent
