import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FilterDropdown from '../../problems/components/FilterDropdown'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import submissionsStyles from '../../submissions/pages/SubmissionsPage.module.css'
import type { Contest } from '../data'
import {
  createMockContestParticipants,
  filterContestParticipants,
  formatParticipantRegistrationDate,
  type ContestParticipantStatus,
} from '../participants'
import tableStyles from './ContestDataTable.module.css'
import styles from './ContestParticipantsTab.module.css'

const statusOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'registered', label: 'Đã đăng ký' },
  { value: 'participated', label: 'Đã tham gia' },
]

function ContestParticipantsTab({ contest }: { contest: Contest }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ContestParticipantStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(submissionPageSizes[0])
  const participants = useMemo(() => createMockContestParticipants(contest), [contest])
  const filteredParticipants = useMemo(
    () => filterContestParticipants(participants, query, status),
    [participants, query, status],
  )
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageParticipants = filteredParticipants.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const paginationProps = {
    currentPage,
    pageSize,
    totalItems: filteredParticipants.length,
    pageSizes: submissionPageSizes,
    label: 'thành viên cuộc thi',
    summaryLabel: 'thành viên',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={styles.content} aria-labelledby="contest-participants-title">
      <header className={styles.heading}>
        <h2 id="contest-participants-title">Danh sách thành viên</h2>
        <span className={tableStyles.participantCount}>
          {participants.length.toLocaleString('vi-VN')} thành viên
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
        {pageParticipants.length === 0 ? (
          <div className={tableStyles.empty}>
            <strong>
              {participants.length === 0
                ? 'Chưa có thành viên tham gia cuộc thi'
                : 'Không tìm thấy thành viên phù hợp'}
            </strong>
            {participants.length > 0 && <p>Hãy thử username hoặc trạng thái khác.</p>}
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
                {pageParticipants.map((participant, index) => (
                  <tr key={participant.id}>
                    <td className={styles.numberCell}>{(currentPage - 1) * pageSize + index + 1}</td>
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
