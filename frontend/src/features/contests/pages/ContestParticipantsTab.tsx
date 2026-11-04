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
import { useContestText } from '../translate'
import tableStyles from './ContestDataTable.module.css'
import styles from './ContestParticipantsTab.module.css'

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
  const { text, locale } = useContestText()
  const statusOptions = [
    { value: 'all', label: text('allStatuses', 'Tất cả', 'All') },
    { value: 'registered', label: text('registered', 'Đã đăng ký', 'Registered') },
    { value: 'participated', label: text('participated', 'Đã tham gia', 'Participated') },
  ]
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
    text,
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
            : text('participantsRequestError', 'Không thể tải danh sách thành viên. Vui lòng thử lại.', 'Could not load the participant list. Please try again.'),
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
    text,
  ])

  const hasFilters = Boolean(query.trim()) || status !== 'all'
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: total,
    pageSizes: submissionPageSizes,
    label: text('contestMembers', 'thành viên cuộc thi', 'contest members'),
    summaryLabel: text('members', 'thành viên', 'members'),
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
        <h2 id="contest-participants-title">{text('participantsTitle', 'Danh sách thành viên', 'Participants')}</h2>
        <span className={tableStyles.participantCount}>
          {totalParticipants.toLocaleString(locale)} {text('members', 'thành viên', 'members')}
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
            aria-label={text('searchParticipantLabel', 'Tìm kiếm theo tên coder', 'Search participants by coder name')}
            placeholder={text('searchParticipantPlaceholder', 'Tìm kiếm theo tên coder...', 'Search by coder name...')}
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <FilterDropdown
          label={text('statusFilter', 'Trạng thái', 'Status')}
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
          {text('resetFilters', 'Đặt lại', 'Reset')}
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
              {text('retry', 'Thử lại', 'Retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className={tableStyles.empty} role="status" aria-live="polite">
            <strong>{text('participantsLoading', 'Đang tải danh sách thành viên…', 'Loading participants…')}</strong>
          </div>
        ) : data?.items.length === 0 ? (
          <div className={tableStyles.empty}>
            <strong>
              {totalParticipants === 0
                ? text('noParticipants', 'Chưa có thành viên tham gia cuộc thi', 'No participants have joined this contest yet')
                : text('noMatchingParticipants', 'Không tìm thấy thành viên phù hợp', 'No matching participants found')}
            </strong>
            {totalParticipants > 0 && hasFilters && <p>{text('changeParticipantFilters', 'Hãy thử username hoặc trạng thái khác.', 'Try a different username or status.')}</p>}
          </div>
        ) : (
          <div className={tableStyles.tableWrap} role="region" aria-label={text('participantsTableLabel', 'Danh sách thành viên cuộc thi', 'Contest participants table')} tabIndex={0}>
            <table className={`${tableStyles.table} ${styles.table}`}>
              <thead>
                <tr>
                  <th scope="col">{text('number', 'STT', 'NO.')}</th>
                  <th scope="col">{text('coder', 'THÍ SINH', 'CODER')}</th>
                  <th scope="col">{text('registeredAt', 'THỜI GIAN ĐĂNG KÝ', 'REGISTERED AT')}</th>
                  <th scope="col">{text('status', 'TRẠNG THÁI', 'STATUS')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((participant, index) => (
                  <tr key={participant.userId}>
                    <td className={styles.numberCell}>{(page - 1) * pageSize + index + 1}</td>
                    <td className={styles.coderCell}>
                      <span className={styles.avatar} aria-hidden="true">
                        {participant.username.slice(0, 1).toLocaleUpperCase(locale)}
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
                      {formatParticipantRegistrationDate(participant.registeredAt, locale)}
                    </td>
                    <td className={styles.statusCell}>
                      <span className={`${styles.statusBadge} ${styles[participant.status]}`}>
                        {participant.status === 'participated' ? text('participated', 'Đã tham gia', 'Participated') : text('registered', 'Đã đăng ký', 'Registered')}
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
