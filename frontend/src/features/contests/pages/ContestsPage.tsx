import { useState } from 'react'
import { useToast } from '../../../components/ui/toast-context'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import {
  formatContestDate,
  ongoingContests,
  paginateContests,
  pastContests,
  searchContests,
  upcomingContests,
  type Contest,
  type ContestStatus,
} from '../data'
import styles from './ContestsPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]

type ContestSectionConfig = {
  title: string
  status: ContestStatus
  contests: Contest[]
  actionLabel: string
  participantLabel: string
  note?: string
}

const sections: ContestSectionConfig[] = [
  {
    title: 'Các cuộc thi đang diễn ra',
    status: 'ongoing',
    contests: ongoingContests,
    actionLabel: 'Tham gia',
    participantLabel: 'thành viên đang tham gia',
  },
  {
    title: 'Các cuộc thi sắp tới',
    status: 'upcoming',
    contests: upcomingContests,
    actionLabel: 'Đăng ký',
    participantLabel: 'thành viên đã đăng ký',
  },
  {
    title: 'Các cuộc thi đã qua',
    status: 'past',
    contests: pastContests,
    actionLabel: 'Tham gia ảo',
    participantLabel: 'đã tham gia (tham gia ảo)',
    note: 'Số liệu thành viên: tham gia trực tiếp (tham gia ảo).',
  },
]

function ContestSection({ config }: { config: ContestSectionConfig }) {
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const filteredContests = searchContests(config.contests, query)
  const pageContests = paginateContests(filteredContests, page, pageSize)
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: filteredContests.length,
    pageSizes: submissionPageSizes,
    label: config.title,
    summaryLabel: 'cuộc thi',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={styles.card} aria-labelledby={`${config.status}-title`}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 id={`${config.status}-title`}>{config.title}</h2>
          {config.note ? <p className={styles.note}>{config.note}</p> : null}
        </div>
        <span className={styles.count}>{filteredContests.length} cuộc thi</span>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            aria-label={`Tìm kiếm ${config.title.toLocaleLowerCase('vi')}`}
            placeholder="Tìm theo tên cuộc thi..."
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>

      <div className={styles.paginationTop}>
        <SubmissionPagination {...paginationProps} showPageSize={false} />
      </div>

      {pageContests.length === 0 ? (
        <div className={styles.empty}>
          <strong>{query ? 'Không tìm thấy cuộc thi phù hợp' : 'Chưa có cuộc thi nào'}</strong>
          <p>{query ? 'Hãy thử thay đổi từ khóa tìm kiếm.' : 'Các cuộc thi sẽ xuất hiện tại đây.'}</p>
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label={config.title} tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Tên cuộc thi</th>
                <th scope="col" className={styles.participantColumn}>Thành viên</th>
                <th scope="col" className={styles.actionColumn}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageContests.map((contest) => (
                <tr key={contest.id}>
                  <td>
                    <div className={styles.contestDetails}>
                      <strong className={styles.contestTitle}>{contest.title}</strong>
                      <div className={styles.metadata}>
                        <span><b>Bắt đầu:</b> {formatContestDate(contest.startTime)}</span>
                        <span><b>Kết thúc:</b> {formatContestDate(contest.endTime)}</span>
                        <span><b>Thời gian làm bài:</b> {contest.durationMinutes} phút</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.participantCell}>
                    <span
                      aria-label={config.status === 'past'
                        ? `${contest.participantCount} thành viên đã tham gia, ${contest.virtualParticipantCount} thành viên tham gia ảo`
                        : `${contest.participantCount} ${config.participantLabel}`}
                      title={config.status === 'past'
                        ? `${contest.participantCount} đã tham gia; ${contest.virtualParticipantCount} tham gia ảo`
                        : `${contest.participantCount} ${config.participantLabel}`}
                    >
                      {contest.participantCount.toLocaleString('vi-VN')}
                      {config.status === 'past'
                        ? ` (${contest.virtualParticipantCount.toLocaleString('vi-VN')})`
                        : ''}
                    </span>
                  </td>
                  <td className={styles.actionCell}>
                    <button
                      className={styles.actionButton}
                      type="button"
                      onClick={() => showToast('Chức năng đang phát triển.')}
                    >
                      {config.actionLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.paginationBottom}>
        <SubmissionPagination {...paginationProps} />
      </div>
    </section>
  )
}

function ContestsPage() {
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Danh sách các cuộc thi</h1>
        <div className={styles.sections}>
          {sections.map((config) => <ContestSection key={config.status} config={config} />)}
        </div>
      </div>
    </main>
  )
}

export default ContestsPage
