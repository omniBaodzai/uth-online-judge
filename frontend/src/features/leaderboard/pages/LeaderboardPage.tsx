import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { resolveAvatarUrl } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import UserAvatar from '../../profile/components/UserAvatar'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { useLeaderboardData } from '../useLeaderboardData'
import styles from './LeaderboardPage.module.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function formatPerformance(percentile: number | null, comparableProblems: number): string {
  if (percentile === null || comparableProblems === 0) return 'Chưa đủ dữ liệu'
  return `Top ${Math.max(1, Math.ceil(percentile * 100))}% · ${comparableProblems} bài so sánh`
}

function profilePath(username: string | null, userId: string): string {
  return username ? `/users/${encodeURIComponent(username)}` : `/users/id/${encodeURIComponent(userId)}`
}

function LeaderboardPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error } = useLeaderboardData({ page, pageSize: PAGE_SIZE, q: debouncedQuery })
  const pageItems = data?.items ?? []
  const totalUsers = data?.totalUsers ?? (debouncedQuery ? null : data?.total ?? 0)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const paginationProps = {
    currentPage: page,
    pageSize: PAGE_SIZE,
    totalItems: data?.total ?? 0,
    pageSizes: [PAGE_SIZE],
    label: 'coder',
    summaryLabel: 'coder',
    additionalSummary: debouncedQuery && totalUsers !== null ? `${totalUsers} tổng coder` : undefined,
    showPageSize: false,
    onPageChange: setPage,
    onPageSizeChange: () => undefined,
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <header className={styles.header}>
          <h1>Bảng xếp hạng những coder chăm chỉ nhất</h1>
          <p></p>
        </header>

        {user && data?.viewerRank ? (
          <p className={styles.viewerRank} role="status">Thứ hạng của bạn: <strong>#{data.viewerRank}</strong></p>
        ) : user && data && !loading ? (
          <p className={styles.viewerRank} role="status">Bạn chưa có thành tích trong bảng xếp hạng.</p>
        ) : null}

        <form className={styles.filters} role="search" onSubmit={(event) => event.preventDefault()}>
          <div className={styles.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label="Tìm coder theo username"
              maxLength={100}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo username coder..."
            />
          </div>
        </form>

        <section className={styles.card} aria-label="Bảng xếp hạng coder">
          <div className={styles.topPagination}>
            <SubmissionPagination {...paginationProps} />
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {loading && !data ? <p className={styles.state} role="status">Đang tải bảng xếp hạng…</p> : null}
          {!loading && !error && data && pageItems.length === 0 ? (
            <p className={styles.state}>{query ? 'Không tìm thấy coder phù hợp.' : 'Chưa có coder để xếp hạng.'}</p>
          ) : null}
          {!error && pageItems.length > 0 ? (
            <div className={styles.tableScroll} tabIndex={0} aria-label="Danh sách bảng xếp hạng">
              <div className={styles.listHeader} aria-hidden="true">
                <span>THỨ HẠNG</span>
                <span>ĐIỂM</span>
                <span>CODER</span>
                <span>SỐ BÀI AC</span>
              </div>
              <ol className={styles.list}>
                {pageItems.map((entry) => {
                  const isViewer = entry.userId === user?.id
                  const isTopThree = entry.rank >= 1 && entry.rank <= 3
                  return (
                    <li
                      className={`${styles.entry} ${isTopThree ? styles[`top${entry.rank}`] : ''} ${isViewer ? styles.viewer : ''}`}
                      key={entry.userId}
                      aria-current={isViewer ? 'true' : undefined}
                    >
                      <Link
                        className={styles.rowLink}
                        to={profilePath(entry.username, entry.userId)}
                        aria-label={`Mở hồ sơ của ${entry.displayName}, hạng ${entry.rank}`}
                      >
                        <span className={styles.rank} aria-label={`Hạng ${entry.rank}`}>
                          {entry.rank === 1 ? <Crown className={styles.crown} size={16} aria-hidden="true" /> : null}
                          <span className={styles.rankNumber}>{entry.rank}</span>
                        </span>
                        <span className={styles.points}>{entry.cumulativePoints}</span>
                        <span className={styles.coder}>
                          <UserAvatar
                            source={resolveAvatarUrl(entry.avatarUrl)}
                            username={entry.username ?? entry.displayName}
                            label={`Ảnh đại diện ${entry.displayName}`}
                          />
                          <span className={styles.identity}>
                            <strong>{entry.displayName}</strong>
                            <span>@{entry.username ?? entry.userId.slice(0, 8)}</span>
                            {entry.comparableProblems > 0 ? (
                              <span className={styles.performance}>{formatPerformance(entry.performancePercentile, entry.comparableProblems)}</span>
                            ) : null}
                          </span>
                        </span>
                        <span className={styles.solvedCount}>{entry.solvedCount}</span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}
          <div className={styles.footer}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </section>
      </div>
    </main>
  )
}

export default LeaderboardPage
