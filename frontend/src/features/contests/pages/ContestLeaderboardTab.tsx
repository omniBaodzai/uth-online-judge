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
import { useContestText } from '../translate'
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
  const { text, locale } = useContestText()
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
            : text('leaderboardRequestError', 'Không thể tải bảng xếp hạng. Vui lòng thử lại.', 'Could not load the leaderboard. Please try again.'),
        })
      })

    return () => controller.abort()
  }, [contestId, page, pageSize, queryInput, reloadKey, requestKey, requester, text])

  const pageEntries = leaderboard?.items ?? []

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: leaderboard?.total ?? 0,
    pageSizes: submissionPageSizes,
    label: text('leaderboardLabel', 'bảng xếp hạng cuộc thi', 'contest leaderboard'),
    summaryLabel: text('contestants', 'thí sinh', 'contestants'),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      if (size === 10 || size === 20 || size === 50) setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={sharedStyles.card} aria-labelledby="contest-leaderboard-title">
      <header className={sharedStyles.header}>
        <h2 id="contest-leaderboard-title">{text('leaderboardTitle', 'Bảng xếp hạng', 'Leaderboard')}</h2>
        <span className={sharedStyles.participantCount}>{(leaderboard?.totalParticipants ?? 0).toLocaleString(locale)} {text('contestants', 'thí sinh', 'contestants')}</span>
      </header>

      <div className={sharedStyles.toolbar} role="search">
        <label className={sharedStyles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={text('searchCoderLabel', 'Tìm coder theo username', 'Search coders by username')}
            placeholder={text('searchCoderPlaceholder', 'Tìm theo username...', 'Search by username...')}
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
        <div className={sharedStyles.empty} role="status">{text('leaderboardLoading', 'Đang tải bảng xếp hạng…', 'Loading leaderboard…')}</div>
      ) : error ? (
        <div className={sharedStyles.empty} role="alert">
          <strong>{text('leaderboardLoadError', 'Không thể tải bảng xếp hạng', 'Could not load the leaderboard')}</strong>
          <p>{error}</p>
          <button
            className={styles.retryButton}
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {text('retry', 'Thử lại', 'Retry')}
          </button>
        </div>
      ) : pageEntries.length === 0 ? (
        <div className={sharedStyles.empty}>
          <strong>{queryInput ? text('noMatchingCoders', 'Không tìm thấy coder phù hợp', 'No matching coders found') : text('noRankedContestants', 'Chưa có thí sinh trong bảng xếp hạng', 'No contestants on the leaderboard yet')}</strong>
          <p>{queryInput ? text('tryAnotherUsername', 'Hãy thử username khác.', 'Try another username.') : text('leaderboardWillAppear', 'Bảng xếp hạng sẽ hiển thị khi có thí sinh.', 'The leaderboard will appear once contestants join.')}</p>
        </div>
      ) : (
        <div className={sharedStyles.tableWrap} role="region" aria-label={text('leaderboardTableLabel', 'Bảng xếp hạng thí sinh', 'Contest leaderboard table')} tabIndex={0}>
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th scope="col">{text('rank', 'THỨ HẠNG', 'RANK')}</th>
                <th scope="col">{text('coder', 'THÍ SINH', 'CODER')}</th>
                <th scope="col">{text('totalScore', 'TỔNG ĐIỂM', 'TOTAL SCORE')}</th>
                <th scope="col">{text('acceptedProblems', 'SỐ BÀI AC', 'SOLVED')}</th>
                <th scope="col">{text('time', 'THỜI GIAN', 'TIME')}</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry) => {
                const avatarUrl = resolveAvatarUrl(entry.avatarUrl)
                const username = entry.username ?? text('anonymous', 'Ẩn danh', 'Anonymous')
                return (
                  <tr key={entry.userId}>
                    <td className={styles.rankCell}>
                      <span className={styles.rankValue}>
                        {entry.rank <= 3 ? (
                          <Medal
                            className={`${styles.medal} ${styles[`medal${entry.rank}`]}`}
                            size={18}
                            aria-label={text('rankNumber', 'Hạng {{rank}}', 'Rank {{rank}}', { rank: entry.rank.toLocaleString(locale) })}
                          />
                        ) : null}
                        {entry.rank.toLocaleString(locale)}
                      </span>
                    </td>
                    <td className={styles.coderCell}>
                      <span className={styles.avatar} aria-hidden="true">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" />
                        ) : (
                          username.slice(0, 1).toLocaleUpperCase(locale)
                        )}
                      </span>
                      <span className={styles.username}>{username}</span>
                    </td>
                    <td className={styles.valueCell}>{entry.totalScore.toLocaleString(locale)}</td>
                    <td className={styles.valueCell}>{entry.acceptedProblems.toLocaleString(locale)}/{entry.totalProblems.toLocaleString(locale)}</td>
                    <td className={styles.valueCell}>
                      {formatContestDuration(entry.elapsedSeconds === null ? null : entry.elapsedSeconds * 1000, locale)}
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
