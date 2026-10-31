import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Archive, ExternalLink, Eye, Info, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useContestAdmin } from './useContestAdmin'
import {
  formatContestDateSafe,
  getContestTimeStatus,
  normalizeContestSearch,
  publicationLabels,
  timeStatusLabels,
  type ContestTimeStatus,
} from './contest-utils'
import type { Contest, ContestPublicationStatus } from './types'
import adminStyles from '../admin.module.css'
import styles from './AdminContestsPage.module.css'

type PendingStatusChange = {
  contest: Contest
  status: ContestPublicationStatus
}

const PAGE_SIZES = submissionPageSizes
const DEFAULT_PAGE_SIZE = 10

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={adminStyles.metricCard}>
      <span className={`${adminStyles.metricMark} ${adminStyles[tone]}`} />
      <p>{label}</p>
      <strong>{value.toLocaleString('vi-VN')}</strong>
      <small>Từ dữ liệu cuộc thi</small>
    </article>
  )
}

function ContestDetailsDialog({
  contest,
  preview,
  onClose,
}: {
  contest: Contest
  preview: boolean
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = controls.item(0)
    const last = controls.item(controls.length - 1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className={adminStyles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`${adminStyles.dialog} ${styles.detailDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contest-detail-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className={styles.dialogHeading}>
          <div>
            <h2 id="contest-detail-title">{preview ? 'Xem trước cuộc thi' : 'Chi tiết cuộc thi'}</h2>
            <p>{contest.code}</p>
          </div>
          <button
            ref={closeButtonRef}
            className={adminStyles.iconButton}
            type="button"
            aria-label="Đóng chi tiết cuộc thi"
            onClick={onClose}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
        <h3>{contest.title}</h3>
        <p className={styles.detailDescription}>{contest.description || 'Chưa có mô tả cuộc thi.'}</p>
        {contest.rules && <p className={styles.detailDescription}>{contest.rules}</p>}
        <dl className={styles.detailGrid}>
          <div><dt>Bắt đầu</dt><dd>{formatContestDateSafe(contest.startTime)}</dd></div>
          <div><dt>Kết thúc</dt><dd>{formatContestDateSafe(contest.endTime)}</dd></div>
          <div><dt>Thời gian làm bài</dt><dd>{contest.durationMinutes || 'Chưa thiết lập'} phút</dd></div>
          <div><dt>Hình thức</dt><dd>{contest.settings.visibility === 'public' ? 'Công khai' : 'Riêng tư'}</dd></div>
        </dl>
        <strong>Bài tập ({contest.problems.length})</strong>
        {contest.problems.length > 0 ? (
          <ol className={styles.dialogProblemList}>
            {contest.problems.map((problem) => (
              <li key={problem.problemId}>{problem.code} — {problem.title} ({problem.maxScore} điểm)</li>
            ))}
          </ol>
        ) : <p className={styles.detailDescription}>Chưa có bài tập được chọn.</p>}
        <div className={adminStyles.dialogActions}>
          <button className={adminStyles.buttonSecondary} type="button" onClick={onClose}>Đóng</button>
        </div>
      </section>
    </div>
  )
}

function AdminContestsPage() {
  const { contests, updatePublicationStatus } = useContestAdmin()
  const [query, setQuery] = useState('')
  const [publication, setPublication] = useState<ContestPublicationStatus | 'all'>('all')
  const [timeFilter, setTimeFilter] = useState<ContestTimeStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)
  const [details, setDetails] = useState<{ contest: Contest; preview: boolean } | null>(null)
  const [now] = useState(() => Date.now())

  const timeStatuses = useMemo(
    () => new Map(contests.map((contest) => [contest.id, getContestTimeStatus(contest, now)])),
    [contests, now],
  )
  const filteredContests = useMemo(() => {
    const search = normalizeContestSearch(query.trim())
    return contests.filter((contest) => {
      const matchesSearch = !search || normalizeContestSearch(`${contest.code} ${contest.title}`).includes(search)
      const matchesPublication = publication === 'all' || contest.publicationStatus === publication
      const matchesTime = timeFilter === 'all' || timeStatuses.get(contest.id) === timeFilter
      return matchesSearch && matchesPublication && matchesTime
    })
  }, [contests, publication, query, timeFilter, timeStatuses])
  const totalPages = Math.max(1, Math.ceil(filteredContests.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleContests = filteredContests.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function resetFilters() {
    setQuery('')
    setPublication('all')
    setTimeFilter('all')
    setPage(1)
  }

  const paginationProps = {
    currentPage,
    pageSize,
    totalItems: filteredContests.length,
    pageSizes: PAGE_SIZES,
    label: 'cuộc thi',
    summaryLabel: 'cuộc thi',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  const stats = {
    total: contests.length,
    ongoing: contests.filter((contest) => timeStatuses.get(contest.id) === 'ongoing').length,
    upcoming: contests.filter((contest) => timeStatuses.get(contest.id) === 'upcoming').length,
    ended: contests.filter((contest) => timeStatuses.get(contest.id) === 'ended').length,
  }

  function confirmStatusChange() {
    if (!pendingStatusChange) return
    updatePublicationStatus(pendingStatusChange.contest.id, pendingStatusChange.status)
    setPendingStatusChange(null)
  }

  return (
    <>
      <div className={adminStyles.pageHeading}>
        <div>
          <p className={adminStyles.eyebrow}>QUẢN LÝ NỘI DUNG</p>
          <h1>Quản lý cuộc thi</h1>
          <p className={adminStyles.pageSubtitle}>Theo dõi lịch tổ chức, trạng thái xuất bản và danh sách cuộc thi.</p>
        </div>
        <Link className={adminStyles.buttonPrimary} to="/admin/contests/new">
          <AdminIcon name="plus" /> Tạo cuộc thi
        </Link>
      </div>

      <div className={`${adminStyles.demoNotice} ${styles.demoNotice}`} role="note">
        <Info size={17} aria-hidden="true" />
        <span>Dữ liệu đang lưu trong state của phiên Admin này; tải lại trang sẽ khôi phục dữ liệu mẫu ban đầu. Chưa kết nối Backend/API.</span>
      </div>

      <div className={`${adminStyles.metricGrid} ${styles.statsGrid}`}>
        <Metric label="Tổng cuộc thi" value={stats.total} tone="teal" />
        <Metric label="Đang diễn ra" value={stats.ongoing} tone="green" />
        <Metric label="Sắp diễn ra" value={stats.upcoming} tone="amber" />
        <Metric label="Đã kết thúc" value={stats.ended} tone="slate" />
      </div>

      <section className={adminStyles.panel} aria-label="Danh sách cuộc thi">
        <div className={adminStyles.toolbar}>
          <label className={adminStyles.searchField}>
            <AdminIcon name="search" size={18} />
            <input
              type="search"
              aria-label="Tìm theo mã hoặc tên cuộc thi"
              placeholder="Tìm theo tên hoặc mã cuộc thi…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
            aria-label="Lọc theo trạng thái xuất bản"
            value={publication}
            onChange={(event) => {
              setPublication(event.target.value as ContestPublicationStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái xuất bản</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
          <select
            aria-label="Lọc theo thời gian tổ chức"
            value={timeFilter}
            onChange={(event) => {
              setTimeFilter(event.target.value as ContestTimeStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả thời gian</option>
            <option value="upcoming">Sắp diễn ra</option>
            <option value="ongoing">Đang diễn ra</option>
            <option value="ended">Đã kết thúc</option>
            <option value="unscheduled">Chưa thiết lập</option>
          </select>
          <button className={adminStyles.buttonQuiet} type="button" onClick={resetFilters}>Đặt lại</button>
        </div>

        <p className={styles.resultsHint} aria-live="polite">
          {filteredContests.length} cuộc thi phù hợp
        </p>
        <div className={styles.paginationTop}>
          <SubmissionPagination {...paginationProps} showPageSize={false} />
        </div>

        {filteredContests.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Không tìm thấy cuộc thi phù hợp</strong>
            <p>Hãy thử từ khóa khác hoặc đặt lại bộ lọc.</p>
            <button className={adminStyles.buttonSecondary} type="button" onClick={resetFilters}>Đặt lại bộ lọc</button>
          </div>
        ) : (
          <div className={`${adminStyles.tableWrap} ${styles.tableWrap}`} role="region" aria-label="Bảng quản lý cuộc thi" tabIndex={0}>
            <table className={styles.contestTable}>
              <thead>
                <tr>
                  <th scope="col">TÊN CUỘC THI</th>
                  <th scope="col">BẮT ĐẦU</th>
                  <th scope="col">KẾT THÚC</th>
                  <th scope="col">THÀNH VIÊN</th>
                  <th scope="col">TRẠNG THÁI</th>
                  <th scope="col">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {visibleContests.map((contest) => {
                  const timeStatus = timeStatuses.get(contest.id) ?? 'unscheduled'
                  return (
                    <tr key={contest.id}>
                      <td data-label="Tên cuộc thi">
                        <button className={styles.contestName} type="button" onClick={() => setDetails({ contest, preview: false })}>
                          {contest.title}
                        </button>
                      </td>
                      <td className={styles.dateCell} data-label="Bắt đầu">{formatContestDateSafe(contest.startTime)}</td>
                      <td className={styles.dateCell} data-label="Kết thúc">{formatContestDateSafe(contest.endTime)}</td>
                      <td className={styles.participantCell} data-label="Thành viên">{contest.participantCount.toLocaleString('vi-VN')}</td>
                      <td data-label="Trạng thái">
                        <div className={styles.statusStack}>
                          <span className={styles.statusLabel}>Quản lý</span>
                          <span className={`${adminStyles.badge} ${adminStyles[`status_${contest.publicationStatus}`]}`}>
                            {publicationLabels[contest.publicationStatus]}
                          </span>
                          <span className={styles.statusLabel}>Thời gian</span>
                          <span className={`${adminStyles.badge} ${styles[`time_${timeStatus}`]}`}>
                            {timeStatusLabels[timeStatus]}
                          </span>
                        </div>
                      </td>
                      <td className={styles.actionsCell} data-label="Thao tác">
                        <div className={`${adminStyles.rowActions} ${styles.rowActions}`}>
                          <button
                            className={adminStyles.iconButton}
                            type="button"
                            onClick={() => setDetails({ contest, preview: false })}
                          >
                            <Eye size={14} aria-hidden="true" /> Chi tiết
                          </button>
                          <Link
                            className={adminStyles.iconButton}
                            aria-label={`Chỉnh sửa ${contest.code}`}
                            to={`/admin/contests/${encodeURIComponent(contest.id)}/edit`}
                          >
                            <AdminIcon name="edit" size={14} /> Sửa
                          </Link>
                          {contest.publicationStatus === 'published' && (
                            contest.studentPageId ? (
                              <Link
                                className={`${adminStyles.iconButton} ${styles.studentLink}`}
                                to={`/contests/${encodeURIComponent(contest.studentPageId)}`}
                              >
                                <ExternalLink size={14} aria-hidden="true" /> Trang học viên
                              </Link>
                            ) : (
                              <button
                                className={`${adminStyles.iconButton} ${styles.studentLink}`}
                                type="button"
                                onClick={() => setDetails({ contest, preview: true })}
                              >
                                <Eye size={14} aria-hidden="true" /> Xem trước
                              </button>
                            )
                          )}
                          {contest.publicationStatus === 'published' && (
                            <button
                              className={`${adminStyles.iconButton} ${styles.archivedAction}`}
                              type="button"
                              onClick={() => setPendingStatusChange({ contest, status: 'archived' })}
                            >
                              <Archive size={14} aria-hidden="true" /> Lưu trữ
                            </button>
                          )}
                          {contest.publicationStatus === 'archived' && (
                            <button
                              className={adminStyles.iconButton}
                              type="button"
                              onClick={() => updatePublicationStatus(contest.id, 'published')}
                            >
                              <RotateCcw size={14} aria-hidden="true" /> Khôi phục
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.paginationBottom}>
          <SubmissionPagination {...paginationProps} />
        </div>
      </section>

      {pendingStatusChange && (
        <ConfirmDialog
          title="Lưu trữ cuộc thi?"
          description={`Cuộc thi “${pendingStatusChange.contest.title}” sẽ chuyển sang trạng thái đã lưu trữ trong mock state.`}
          confirmLabel="Lưu trữ"
          danger
          onConfirm={confirmStatusChange}
          onCancel={() => setPendingStatusChange(null)}
        />
      )}
      {details && (
        <ContestDetailsDialog
          contest={details.contest}
          preview={details.preview}
          onClose={() => setDetails(null)}
        />
      )}
    </>
  )
}

export default AdminContestsPage
