import { useEffect, useState } from 'react'
import { Medal, Search } from 'lucide-react'
import { ApiError, resolveAvatarUrl } from '../../auth/api'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import {
  getStudentContestLeaderboard,
  type StudentContestRequester,
  type StudentContestLeaderboardPage,
} from '../student-contests.api'
import { formatContestDuration } from '../leaderboard'
import styles from './ContestLeaderboardTab.module.css'
import sharedStyles from './ContestDataTable.module.css'

const DEFAULT_PAGE_SIZE: 10 | 20 | 50 = 10

function ContestLeaderboardTab({
  contestId,
  requester,
}: {
  contestId: string
  requester: StudentContestRequester
}) {
  const [queryInput, setQueryInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(DEFAULT_PAGE_SIZE)
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<{
    key: string
    page: StudentContestLeaderboardPage
  } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const requestKey = JSON.stringify([contestId, page, pageSize, queryInput, reloadKey])
  const leaderboard = loaded?.key === requestKey ? loaded.page : null
  const error = failure?.key === requestKey ? failure.message : ''
  const isLoading = leaderboard === null && failure?.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    getStudentContestLeaderboard(
      requester,
      contestId,
      { page, pageSize, search: queryInput },
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setLoaded({ key: requestKey, page: response })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setFailure({
          key: requestKey,
          message: requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải bảng xếp hạng. Vui lòng thử lại.',
        })
      })

    return () => controller.abort()
  }, [contestId, page, pageSize, queryInput, reloadKey, requestKey, requester])

  const pageEntries = leaderboard?.items ?? []

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: leaderboard?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: 'bảng xếp hạng cuộc thi',
    summaryLabel: 'thí sinh',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      if (size === 10 || size === 20 || size === 50) setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={sharedStyles.card} aria-labelledby="contest-leaderboard-title">
      <header className={sharedStyles.header}>
        <h2 id="contest-leaderboard-title">Bảng xếp hạng</h2>
        <span className={sharedStyles.participantCount}>{leaderboard?.totalParticipants ?? 0} thí sinh</span>
      </header>

      <div className={sharedStyles.toolbar} role="search">
        <label className={sharedStyles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Tìm coder theo username"
            placeholder="Tìm theo username..."
            maxLength={100}
            value={queryInput}
            onChange={(event) => {
              setQueryInput(event.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>

      <div className={sharedStyles.paginationTop}>
        <SubmissionPagination {...paginationProps} showPageSize={false} />
      </div>

      {isLoading ? (
        <div className={sharedStyles.empty} role="status">Đang tải bảng xếp hạng…</div>
      ) : error ? (
        <div className={sharedStyles.empty} role="alert">
          <strong>Không thể tải bảng xếp hạng</strong>
          <p>{error}</p>
          <button
            className={styles.retryButton}
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : pageEntries.length === 0 ? (
        <div className={sharedStyles.empty}>
          <strong>{queryInput ? 'Không tìm thấy coder phù hợp' : 'Chưa có thí sinh trong bảng xếp hạng'}</strong>
          <p>{queryInput ? 'Hãy thử username khác.' : 'Bảng xếp hạng sẽ hiển thị khi có thí sinh.'}</p>
        </div>
      ) : (
        <div className={sharedStyles.tableWrap} role="region" aria-label="Bảng xếp hạng thí sinh" tabIndex={0}>
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th scope="col">THỨ HẠNG</th>
                <th scope="col">CODER</th>
                <th scope="col">TỔNG ĐIỂM</th>
                <th scope="col">SỐ BÀI AC</th>
                <th scope="col">THỜI GIAN</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry) => {
                const avatarUrl = resolveAvatarUrl(entry.avatarUrl)
                const username = entry.username ?? 'Ẩn danh'
                return (
                  <tr key={entry.userId}>
                    <td className={styles.rankCell}>
                      <span className={styles.rankValue}>
                        {entry.rank <= 3 ? (
                          <Medal
                            className={`${styles.medal} ${styles[`medal${entry.rank}`]}`}
                            size={18}
                            aria-label={`Hạng ${entry.rank}`}
                          />
                        ) : null}
                        {entry.rank}
                      </span>
                    </td>
                    <td className={styles.coderCell}>
                      <span className={styles.avatar} aria-hidden="true">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" />
                        ) : (
                          username.slice(0, 1).toLocaleUpperCase('vi')
                        )}
                      </span>
                      <span className={styles.username}>{username}</span>
                    </td>
                    <td className={styles.valueCell}>{entry.totalScore.toLocaleString('vi-VN')}</td>
                    <td className={styles.valueCell}>{entry.acceptedProblems}/{entry.totalProblems}</td>
                    <td className={styles.valueCell}>
                      {formatContestDuration(entry.elapsedSeconds === null ? null : entry.elapsedSeconds * 1000)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={sharedStyles.paginationBottom}>
        <SubmissionPagination {...paginationProps} />
      </div>
    </section>
  )
}

export default ContestLeaderboardTab
