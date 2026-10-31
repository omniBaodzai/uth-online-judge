import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, request as publicRequest } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import FilterDropdown from '../../problems/components/FilterDropdown'
import { getGlobalSubmissions, type GlobalSubmissionPage } from '../../problems/submit/submission-service'
import { createMockContestSubmissionItems, filterContestSubmissionItems, getContestSubmissionStatistics } from '../../contests/contest-submissions'
import type { Contest } from '../../contests/data'
import SubmissionPagination from './SubmissionPagination'
import SubmissionStatsChart from './SubmissionStatsChart'
import SubmissionTable from './SubmissionTable'
import { submissionPageSizes, verdictFilterOptions } from '../data'
import styles from '../pages/SubmissionsPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

type SubmissionsContentProps = {
  contest?: Contest
  problemCode?: string
  profileUserId?: string
}

function SubmissionsContent({ contest, problemCode, profileUserId }: SubmissionsContentProps) {
  const isContestMode = Boolean(contest)
  const { request: authRequest, accessToken, isLoading: isAuthLoading } = useAuth()
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
  const isLoading = !isContestMode && (isAuthLoading || settled?.key !== requestKey)
  const error = settled?.key === requestKey ? settled.error : ''

  useEffect(() => {
    if (isContestMode || isAuthLoading) return
    const controller = new AbortController()
    getGlobalSubmissions(
      request,
      { page, pageSize, q: debouncedQuery, status: selectedVerdict, language: selectedLanguage, problemCode, userId: profileUserId },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return
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
  }, [isContestMode, request, isAuthLoading, requestKey, page, pageSize, debouncedQuery, selectedVerdict, selectedLanguage, problemCode, profileUserId])

  const contestSubmissions = useMemo(
    () => contest ? createMockContestSubmissionItems(contest) : [],
    [contest],
  )
  const filteredContestSubmissions = useMemo(
    () => filterContestSubmissionItems(contestSubmissions, {
      query: debouncedQuery,
      verdict: selectedVerdict,
      language: selectedLanguage,
    }),
    [contestSubmissions, debouncedQuery, selectedVerdict, selectedLanguage],
  )
  const languageFilterOptions = useMemo(() => {
    const languages = isContestMode
      ? [...new Set(contestSubmissions.map(({ language: value }) => value))].sort()
      : data?.filters.languages ?? []
    return languages.map((value) => ({ value, label: value }))
  }, [isContestMode, contestSubmissions, data?.filters.languages])

  const hasFilters = query !== '' || verdict.length > 0 || language.length > 0
  const totalItems = isContestMode ? filteredContestSubmissions.length : data?.total ?? 0
  const items = isContestMode
    ? filteredContestSubmissions.slice((page - 1) * pageSize, page * pageSize)
    : data?.items ?? []
  const statistics = isContestMode
    ? getContestSubmissionStatistics(filteredContestSubmissions)
    : data?.statistics

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
      setPageSize(size)
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
              <Link to={`/problems/${encodeURIComponent(data?.problem?.code ?? problemCode)}`} className={styles.problemLink}>
                {data?.problem ? data.problem.title : problemCode}
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
        <SubmissionTable
          items={items}
          isLoading={isLoading}
          hasFilters={hasFilters}
          hideProblem={Boolean(problemCode)}
          emptyTitle={contest && !hasFilters ? 'Cuộc thi chưa có bài nộp' : undefined}
          emptyDescription={contest && !hasFilters ? 'Bài nộp trong cuộc thi sẽ xuất hiện tại đây.' : undefined}
        />
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
