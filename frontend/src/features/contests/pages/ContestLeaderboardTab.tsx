import { useState } from 'react'
import { Medal, Search } from 'lucide-react'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { paginateContests } from '../data'
import {
  createMockContestLeaderboard,
  formatContestDuration,
  rankContestLeaderboard,
  searchContestLeaderboard,
} from '../leaderboard'
import styles from './ContestLeaderboardTab.module.css'
import sharedStyles from './ContestDataTable.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]

function ContestLeaderboardTab({ contestId, problemCount }: { contestId: string; problemCount: number }) {
  const [queryInput, setQueryInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const rankedEntries = rankContestLeaderboard(createMockContestLeaderboard(contestId, problemCount))
  const filteredEntries = searchContestLeaderboard(rankedEntries, queryInput)
  const pageEntries = paginateContests(filteredEntries, page, pageSize)

  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: filteredEntries.length,
    pageSizes: submissionPageSizes,
    label: 'bảng xếp hạng cuộc thi',
    summaryLabel: 'thí sinh',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={sharedStyles.card} aria-labelledby="contest-leaderboard-title">
      <header className={sharedStyles.header}>
        <h2 id="contest-leaderboard-title">Bảng xếp hạng</h2>
        <span className={sharedStyles.participantCount}>{rankedEntries.length} thí sinh</span>
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

      {pageEntries.length === 0 ? (
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
              {pageEntries.map((entry) => (
                <tr key={entry.id}>
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
                      {entry.username.slice(0, 1).toLocaleUpperCase('vi')}
                    </span>
                    <span className={styles.username}>{entry.username}</span>
                  </td>
                  <td className={styles.valueCell}>{entry.totalScore.toLocaleString('vi-VN')}</td>
                  <td className={styles.valueCell}>{entry.acceptedCount}/{problemCount}</td>
                  <td className={styles.valueCell}>{formatContestDuration(entry.lastAcceptedTimeMs)}</td>
                </tr>
              ))}
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
