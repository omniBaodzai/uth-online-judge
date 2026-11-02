import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import FilterDropdown from '../../problems/components/FilterDropdown'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import submissionsStyles from '../../submissions/pages/SubmissionsPage.module.css'
import {
  getStudentContestParticipants,
  type StudentContestParticipantsPage,
  type StudentContestRequester,
  type StudentContestParticipantStatus,
} from '../student-contests.api'
import { formatParticipantRegistrationDate } from '../participants'
import tableStyles from './ContestDataTable.module.css'
import styles from './ContestParticipantsTab.module.css'

const statusOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'registered', label: 'Đã đăng ký' },
  { value: 'participated', label: 'Đã tham gia' },
]

const SEARCH_DEBOUNCE_MS = 300

type ContestParticipantsTabProps = {
  contestIdentifier: string
  participantCount: number
  requester: StudentContestRequester
  onParticipantCountChange: (count: number) => void
}

function ContestParticipantsTab({
  contestIdentifier,
  participantCount,
  requester,
  onParticipantCountChange,
}: ContestParticipantsTabProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState<StudentContestParticipantStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10)
  const [loaded, setLoaded] = useState<{
    key: string
    value: StudentContestParticipantsPage
  } | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const queryPending = query.trim() !== debouncedQuery
  const requestKey = JSON.stringify([
    contestIdentifier,
    participantCount,
    page,
    pageSize,
    debouncedQuery,
    status,
    retryKey,
  ])
  const data = loaded?.key === requestKey ? loaded.value : null
  const error = settled?.key === requestKey ? settled.error : ''
  const isLoading = queryPending || settled?.key !== requestKey
  const total = data?.total ?? 0
  const totalParticipants = data?.participantCount ?? participantCount

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (queryPending) return
    const controller = new AbortController()
    getStudentContestParticipants(
      requester,
      contestIdentifier,
      { page, pageSize, search: debouncedQuery, status },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.ceil(result.total / pageSize))
          return
        }
        setLoaded({ key: requestKey, value: result })
        setSettled({ key: requestKey, error: '' })
        onParticipantCountChange(result.participantCount)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error: requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải danh sách thành viên. Vui lòng thử lại.',
        })
      })
    return () => controller.abort()
  }, [
    contestIdentifier,
    debouncedQuery,
    onParticipantCountChange,
    page,
    pageSize,
    queryPending,
    requestKey,
    requester,
    status,
  ])

  const hasFilters = Boolean(query.trim()) || status !== 'all'
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: total,
    pageSizes: submissionPageSizes,
    label: 'thành viên cuộc thi',
    summaryLabel: 'thành viên',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      if (size === 10 || size === 20 || size === 50) {
        setPageSize(size)
        setPage(1)
      }
    },
  }

  return (
    <section className={styles.content} aria-labelledby="contest-participants-title">
      <header className={styles.heading}>
        <h2 id="contest-participants-title">Danh sách thành viên</h2>
        <span className={tableStyles.participantCount}>
          {totalParticipants.toLocaleString('vi-VN')} thành viên
        </span>
      </header>

      <form className={`${submissionsStyles.filters} ${styles.filters}`} role="search" onSubmit={(event) => event.preventDefault()}>
        <label className={submissionsStyles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            aria-label="Tìm kiếm theo tên coder"
            placeholder="Tìm kiếm theo tên coder..."
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <FilterDropdown
          label="Trạng thái"
          options={statusOptions}
          selected={[status]}
          onChange={(value) => {
            const selectedStatus = value[0]
            if (selectedStatus === 'registered' || selectedStatus === 'participated' || selectedStatus === 'all') {
              setStatus(selectedStatus)
            } else {
              setStatus('all')
            }
            setPage(1)
          }}
        />
        <button
          type="button"
          className={submissionsStyles.reset}
          onClick={() => {
            setQuery('')
            setStatus('all')
            setPage(1)
          }}
          disabled={!query && status === 'all'}
        >
          Đặt lại
        </button>
      </form>

      <div className={tableStyles.card}>
        <div className={tableStyles.paginationTop}>
          <SubmissionPagination {...paginationProps} showPageSize={false} />
        </div>
        {error ? (
          <div className={tableStyles.empty} role="alert">
            <strong>{error}</strong>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
              Thử lại
            </button>
          </div>
        ) : isLoading ? (
          <div className={tableStyles.empty} role="status" aria-live="polite">
            <strong>Đang tải danh sách thành viên…</strong>
          </div>
        ) : data?.items.length === 0 ? (
          <div className={tableStyles.empty}>
            <strong>
              {totalParticipants === 0
                ? 'Chưa có thành viên tham gia cuộc thi'
                : 'Không tìm thấy thành viên phù hợp'}
            </strong>
            {totalParticipants > 0 && hasFilters && <p>Hãy thử username hoặc trạng thái khác.</p>}
          </div>
        ) : (
          <div className={tableStyles.tableWrap} role="region" aria-label="Danh sách thành viên cuộc thi" tabIndex={0}>
            <table className={`${tableStyles.table} ${styles.table}`}>
              <thead>
                <tr>
                  <th scope="col">STT</th>
                  <th scope="col">CODER</th>
                  <th scope="col">THỜI GIAN ĐĂNG KÝ</th>
                  <th scope="col">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((participant, index) => (
                  <tr key={participant.userId}>
                    <td className={styles.numberCell}>{(page - 1) * pageSize + index + 1}</td>
                    <td className={styles.coderCell}>
                      <span className={styles.avatar} aria-hidden="true">
                        {participant.username.slice(0, 1).toLocaleUpperCase('vi')}
                        {participant.avatarUrl ? (
                          <img
                            src={participant.avatarUrl}
                            alt=""
                            onError={(event) => { event.currentTarget.hidden = true }}
                          />
                        ) : null}
                      </span>
                      <Link
                        className={styles.username}
                        to={`/users/${encodeURIComponent(participant.username)}`}
                      >
                        {participant.username}
                      </Link>
                    </td>
                    <td className={styles.dateCell}>
                      {formatParticipantRegistrationDate(participant.registeredAt)}
                    </td>
                    <td className={styles.statusCell}>
                      <span className={`${styles.statusBadge} ${styles[participant.status]}`}>
                        {participant.status === 'participated' ? 'Đã tham gia' : 'Đã đăng ký'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={tableStyles.paginationBottom}>
          <SubmissionPagination {...paginationProps} />
        </div>
      </div>
    </section>
  )
}

export default ContestParticipantsTab
