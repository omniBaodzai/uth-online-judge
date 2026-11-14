import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Activity, Archive, CalendarClock, Eye, Flag, RotateCcw, Trophy, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAdmin } from '../useAdmin'
import { contestErrorMessage } from './contest-errors'
import { useContestAdmin } from './useContestAdmin'
import {
  formatContestDateSafe,
  publicationLabels,
  timeStatusLabels,
} from './contest-utils'
import type {
  ContestDetail,
  ContestListItem,
  ContestOverview,
  ContestPublicationStatus,
  ContestTimeStatus,
} from './types'
import adminStyles from '../admin.module.css'
import styles from './AdminContestsPage.module.css'

type PendingArchive = ContestListItem
type TimeFilter = Exclude<ContestTimeStatus, 'UNPUBLISHED'> | 'all'
const PAGE_SIZES = submissionPageSizes
const DEFAULT_PAGE_SIZE = 10

type MetricTone = 'teal' | 'green' | 'amber' | 'slate'

function Metric({ label, value, tone, loading, icon: Icon }: {
  label: string
  value: number | undefined
  tone: MetricTone
  loading: boolean
  icon: LucideIcon
}) {
  return (
    <article className={styles.contestMetricCard}>
      <span className={`${styles.metricIcon} ${styles[`metricIcon_${tone}`]}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <p>{label}</p>
      <strong>{loading || value === undefined ? '—' : value.toLocaleString('vi-VN')}</strong>
    </article>
  )
}

function ContestDetailsDialog({
  id,
  preview,
  onClose,
}: {
  id: string
  preview: boolean
  onClose: () => void
}) {
  const { get } = useContestAdmin()
  const [contest, setContest] = useState<ContestDetail | null>(null)
  const [error, setError] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    get(id).then((value) => {
      if (active) setContest(value)
    }).catch((cause: unknown) => {
      if (active) setError(contestErrorMessage(cause, 'Không thể tải chi tiết cuộc thi.'))
    })
    closeButtonRef.current?.focus()
    return () => { active = false }
  }, [get, id])

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
            <p>{contest?.slug ?? 'Đang tải…'}</p>
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
        {error ? (
          <p className={adminStyles.formMessage} role="alert">{error}</p>
        ) : !contest ? (
          <p className={styles.emptyState} aria-live="polite">Đang tải chi tiết cuộc thi…</p>
        ) : (
          <>
            <h3>{contest.title}</h3>
            <p className={styles.detailDescription}>{contest.description || 'Chưa có mô tả cuộc thi.'}</p>
            {contest.rules && <p className={styles.detailDescription}>{contest.rules}</p>}
            <dl className={styles.detailGrid}>
              <div><dt>Bắt đầu</dt><dd>{formatContestDateSafe(contest.startsAt)}</dd></div>
              <div><dt>Kết thúc</dt><dd>{formatContestDateSafe(contest.endsAt)}</dd></div>
              <div><dt>Thành viên</dt><dd>{contest.participantCount.toLocaleString('vi-VN')}</dd></div>
              <div><dt>Hình thức</dt><dd>{contest.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}</dd></div>
            </dl>
            <strong>Bài tập ({contest.problems.length})</strong>
            {contest.problems.length > 0 ? (
              <ol className={styles.dialogProblemList}>
                {contest.problems.map((problem) => (
                  <li key={problem.problemId}>
                    {problem.problemCode} — {problem.problemTitle} ({problem.maxScore} điểm)
                  </li>
                ))}
              </ol>
            ) : <p className={styles.detailDescription}>Chưa có bài tập được chọn.</p>}
          </>
        )}
        <div className={adminStyles.dialogActions}>
          <button className={adminStyles.buttonSecondary} type="button" onClick={onClose}>Đóng</button>
        </div>
      </section>
    </div>
  )
}

function AdminContestsPage() {
  const api = useContestAdmin()
  const { setNotice } = useAdmin()
  const [pageData, setPageData] = useState<{ items: ContestListItem[]; total: number } | null>(null)
  const [overview, setOverview] = useState<ContestOverview | null>(null)
  const [query, setQuery] = useState('')
  const [publication, setPublication] = useState<ContestPublicationStatus | 'all'>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pendingArchive, setPendingArchive] = useState<PendingArchive | null>(null)
  const [details, setDetails] = useState<{ id: string; preview: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.list({
        page,
        pageSize,
        ...(query.trim() ? { search: query.trim() } : {}),
        ...(publication !== 'all' ? { publicationStatus: publication } : {}),
        ...(timeFilter !== 'all' ? { timeStatus: timeFilter } : {}),
      })
      setPageData({ items: result.items, total: result.total })
      if (result.page !== page) setPage(result.page)
    } catch (cause) {
      setPageData(null)
      setError(contestErrorMessage(cause, 'Không thể tải danh sách cuộc thi.'))
    } finally {
      setLoading(false)
    }
  }, [api, page, pageSize, publication, query, timeFilter])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      setOverview(await api.overview())
    } catch (cause) {
      setError((current) => current || contestErrorMessage(cause, 'Không thể tải thống kê cuộc thi.'))
    } finally {
      setOverviewLoading(false)
    }
  }, [api])

  useEffect(() => {
    let active = true
    api.list({
      page,
      pageSize,
      ...(query.trim() ? { search: query.trim() } : {}),
      ...(publication !== 'all' ? { publicationStatus: publication } : {}),
      ...(timeFilter !== 'all' ? { timeStatus: timeFilter } : {}),
    }).then((result) => {
      if (!active) return
      setPageData({ items: result.items, total: result.total })
      if (result.page !== page) setPage(result.page)
    }).catch((cause: unknown) => {
      if (active) {
        setPageData(null)
        setError(contestErrorMessage(cause, 'Không thể tải danh sách cuộc thi.'))
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [api, page, pageSize, publication, query, timeFilter])

  useEffect(() => {
    let active = true
    api.overview().then((result) => {
      if (active) setOverview(result)
    }).catch((cause: unknown) => {
      if (active) setError((current) => current || contestErrorMessage(cause, 'Không thể tải thống kê cuộc thi.'))
    }).finally(() => {
      if (active) setOverviewLoading(false)
    })
    return () => { active = false }
  }, [api])

  const contests = pageData?.items ?? []
  const total = pageData?.total ?? 0
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))

  function resetFilters() {
    setLoading(true)
    setError('')
    setQuery('')
    setPublication('all')
    setTimeFilter('all')
    setPage(1)
  }

  const paginationProps = {
    currentPage,
    pageSize,
    totalItems: total,
    pageSizes: PAGE_SIZES,
    label: 'cuộc thi',
    summaryLabel: 'cuộc thi',
    onPageChange: (nextPage: number) => {
      setLoading(true)
      setError('')
      setPage(nextPage)
    },
    onPageSizeChange: (size: number) => {
      setLoading(true)
      setError('')
      setPageSize(size)
      setPage(1)
    },
  }

  async function archiveContest() {
    if (!pendingArchive || savingId) return
    const contest = pendingArchive
    setSavingId(contest.id)
    setError('')
    try {
      await api.archive(contest.id)
      setNotice(`Đã lưu trữ cuộc thi “${contest.title}”.`)
      setPendingArchive(null)
      await Promise.all([loadList(), loadOverview()])
    } catch (cause) {
      setError(contestErrorMessage(cause, 'Không thể lưu trữ cuộc thi.'))
    } finally {
      setSavingId('')
    }
  }

  async function restoreContest(contest: ContestListItem) {
    setSavingId(contest.id)
    setError('')
    try {
      await api.restore(contest.id)
      setNotice(`Đã khôi phục cuộc thi “${contest.title}”.`)
      await Promise.all([loadList(), loadOverview()])
    } catch (cause) {
      setError(contestErrorMessage(cause, 'Không thể khôi phục cuộc thi.'))
    } finally {
      setSavingId('')
    }
  }

  return (
    <>
      <div className={`${adminStyles.metricGrid} ${styles.statsGrid}`}>
        <Metric label="Tổng cuộc thi" value={overview?.total} tone="teal" loading={overviewLoading} icon={Trophy} />
        <Metric label="Đang diễn ra" value={overview?.ongoing} tone="green" loading={overviewLoading} icon={Activity} />
        <Metric label="Sắp diễn ra" value={overview?.upcoming} tone="amber" loading={overviewLoading} icon={CalendarClock} />
        <Metric label="Đã kết thúc" value={overview?.ended} tone="slate" loading={overviewLoading} icon={Flag} />
      </div>

      <div className={styles.createRow}>
        <Link className={styles.createButton} to="/admin/contests/new">
          <AdminIcon name="plus" /> Tạo cuộc thi
        </Link>
      </div>

      <section className={adminStyles.panel} aria-label="Danh sách cuộc thi" aria-busy={loading}>
        <div className={adminStyles.toolbar}>
          <label className={adminStyles.searchField}>
            <AdminIcon name="search" size={18} />
            <input
              type="search"
              aria-label="Tìm theo mã hoặc tên cuộc thi"
              placeholder="Tìm theo tên hoặc mã cuộc thi…"
              value={query}
              onChange={(event) => {
                setLoading(true)
                setError('')
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
            aria-label="Lọc theo trạng thái xuất bản"
            value={publication}
            onChange={(event) => {
              setLoading(true)
              setError('')
              setPublication(event.target.value as ContestPublicationStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái xuất bản</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
          <select
            aria-label="Lọc theo thời gian tổ chức"
            value={timeFilter}
            onChange={(event) => {
              setLoading(true)
              setError('')
              setTimeFilter(event.target.value as TimeFilter)
              setPage(1)
            }}
          >
            <option value="all">Tất cả thời gian</option>
            <option value="UPCOMING">Sắp diễn ra</option>
            <option value="ONGOING">Đang diễn ra</option>
            <option value="ENDED">Đã kết thúc</option>
          </select>
          <button className={adminStyles.buttonQuiet} type="button" onClick={resetFilters}>Đặt lại</button>
        </div>

        {error && (
          <p className={adminStyles.formMessage} role="alert">
            {error}{' '}
            <button className={adminStyles.textLink} type="button" onClick={() => { void Promise.all([loadList(), loadOverview()]) }}>
              Thử lại
            </button>
          </p>
        )}
        <div className={styles.paginationTop}>
          <SubmissionPagination {...paginationProps} showPageSize={false} />
        </div>

        {loading ? (
          <div className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</div>
        ) : contests.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{error ? 'Không thể tải danh sách cuộc thi' : 'Không tìm thấy cuộc thi phù hợp'}</strong>
            <p>{error ? 'Kiểm tra kết nối hoặc thử tải lại danh sách.' : 'Hãy thử từ khóa khác hoặc đặt lại bộ lọc.'}</p>
            <button className={adminStyles.buttonSecondary} type="button" onClick={error ? () => { void loadList() } : resetFilters}>
              {error ? 'Thử lại' : 'Đặt lại bộ lọc'}
            </button>
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
                {contests.map((contest) => (
                  <tr key={contest.id}>
                    <td data-label="Tên cuộc thi">
                      <button className={styles.contestName} type="button" onClick={() => setDetails({ id: contest.id, preview: false })}>
                        {contest.title}
                      </button>
                    </td>
                    <td className={styles.dateCell} data-label="Bắt đầu">{formatContestDateSafe(contest.startsAt)}</td>
                    <td className={styles.dateCell} data-label="Kết thúc">{formatContestDateSafe(contest.endsAt)}</td>
                    <td className={styles.participantCell} data-label="Thành viên">{contest.participantCount.toLocaleString('vi-VN')}</td>
                    <td data-label="Trạng thái">
                      <div className={styles.statusStack}>
                        <span className={styles.statusLabel}>Quản lý</span>
                        <span className={`${adminStyles.badge} ${adminStyles[`status_${contest.publicationStatus.toLowerCase()}`]}`}>
                          {publicationLabels[contest.publicationStatus]}
                        </span>
                        <span className={styles.statusLabel}>Thời gian</span>
                        <span className={`${adminStyles.badge} ${styles[`time_${contest.timeStatus.toLowerCase()}`]}`}>
                          {timeStatusLabels[contest.timeStatus]}
                        </span>
                      </div>
                    </td>
                    <td className={styles.actionsCell} data-label="Thao tác">
                      <div className={`${adminStyles.rowActions} ${styles.rowActions}`}>
                        <button
                          className={adminStyles.iconButton}
                          type="button"
                          onClick={() => setDetails({ id: contest.id, preview: false })}
                        >
                          <Eye size={14} aria-hidden="true" /> Chi tiết
                        </button>
                        {contest.publicationStatus !== 'ARCHIVED' && (
                          <Link
                            className={adminStyles.iconButton}
                            aria-label={`Chỉnh sửa ${contest.slug}`}
                            to={`/admin/contests/${encodeURIComponent(contest.id)}/edit`}
                          >
                            <AdminIcon name="edit" size={14} /> Sửa
                          </Link>
                        )}
                        {contest.publicationStatus === 'PUBLISHED' && (
                          <>
                            <button
                              className={`${adminStyles.iconButton} ${styles.studentLink}`}
                              type="button"
                              onClick={() => setDetails({ id: contest.id, preview: true })}
                            >
                              <Eye size={14} aria-hidden="true" /> Xem trước
                            </button>
                            <button
                              className={`${adminStyles.iconButton} ${styles.archivedAction}`}
                              type="button"
                              disabled={savingId === contest.id}
                              onClick={() => setPendingArchive(contest)}
                            >
                              <Archive size={14} aria-hidden="true" /> Lưu trữ
                            </button>
                          </>
                        )}
                        {contest.publicationStatus === 'ARCHIVED' && (
                          <button
                            className={adminStyles.iconButton}
                            type="button"
                            disabled={savingId === contest.id}
                            onClick={() => { void restoreContest(contest) }}
                          >
                            <RotateCcw size={14} aria-hidden="true" /> Khôi phục
                          </button>
                        )}
                      </div>
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

      {pendingArchive && (
        <ConfirmDialog
          title="Lưu trữ cuộc thi?"
          description={`Cuộc thi “${pendingArchive.title}” sẽ chuyển sang trạng thái đã lưu trữ.`}
          confirmLabel="Lưu trữ"
          danger
          busy={savingId === pendingArchive.id}
          onConfirm={() => { void archiveContest() }}
          onCancel={() => { if (!savingId) setPendingArchive(null) }}
        />
      )}
      {details && (
        <ContestDetailsDialog
          key={details.id}
          id={details.id}
          preview={details.preview}
          onClose={() => setDetails(null)}
        />
      )}
    </>
  )
}

export default AdminContestsPage
