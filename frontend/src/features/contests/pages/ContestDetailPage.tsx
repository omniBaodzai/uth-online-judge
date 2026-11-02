import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ChartColumn,
  FileCode,
  Info,
  LogIn,
  RotateCcw,
  Trophy,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, request as publicRequest } from '../../auth/api'
import { buildLoginPath } from '../../auth/return-path'
import { useAuth } from '../../auth/useAuth'
import { useToast } from '../../../components/ui/toast-context'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import SubmissionsContent from '../../submissions/components/SubmissionsContent'
import { submissionPageSizes } from '../../submissions/data'
import {
  cancelStudentContestRegistration,
  getStudentContest,
  registerForStudentContest,
  type StudentContestDetail,
  type StudentContestProblem,
  type StudentContestRequester,
  type StudentContestTimeStatus,
} from '../student-contests.api'
import ContestLeaderboardTab from './ContestLeaderboardTab'
import ContestParticipantsTab from './ContestParticipantsTab'
import ContestStatisticsTab from './ContestStatisticsTab'
import styles from './ContestDetailPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]
const tabs = [
  { id: 'info', label: 'Thông tin', Icon: Info },
  { id: 'stats', label: 'Thống kê', Icon: ChartColumn },
  { id: 'ranking', label: 'Bảng xếp hạng', Icon: Trophy },
  { id: 'participants', label: 'Tham gia', Icon: Users },
  { id: 'submissions', label: 'Các bài nộp', Icon: FileCode },
] as const

type ContestTabId = (typeof tabs)[number]['id']
type ContestPhase = 'ongoing' | 'upcoming' | 'past'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function useCurrentTime(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return now
}

function getPhaseFromStatus(status: StudentContestTimeStatus): ContestPhase {
  if (status === 'UPCOMING') return 'upcoming'
  if (status === 'ONGOING') return 'ongoing'
  return 'past'
}

function padTime(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDateTime(value: string): string {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date(value)).map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.hour}:${parts.minute}:${parts.second} ngày ${parts.day}/${parts.month}/${parts.year}`
}

function getContestDurationMinutes(contest: StudentContestDetail): number {
  return Math.max(0, Math.round(
    (new Date(contest.endsAt).getTime() - new Date(contest.startsAt).getTime()) / 60_000,
  ))
}

function ContestCountdown({ contest, now }: { contest: StudentContestDetail; now: number }) {
  const phase = getPhaseFromStatus(contest.timeStatus)
  const targetTime = phase === 'upcoming' ? contest.startsAt : contest.endsAt
  const targetTimestamp = new Date(targetTime).getTime()
  const remainingSeconds = Number.isFinite(targetTimestamp)
    ? Math.max(0, Math.floor((targetTimestamp - now) / 1000))
    : 0
  const countdownText = `${Math.floor(remainingSeconds / 86_400)} ngày ${padTime(Math.floor((remainingSeconds % 86_400) / 3_600))}:${padTime(Math.floor((remainingSeconds % 3_600) / 60))}:${padTime(remainingSeconds % 60)}`

  return (
    <section className={styles.statusCard} aria-labelledby="contest-status-title">
      <span className={`${styles.statusBadge} ${styles[phase]}`}>
        <span className={styles.statusDot} aria-hidden="true" />
        {phase === 'ongoing' ? 'Đang diễn ra' : phase === 'upcoming' ? 'Sắp diễn ra' : 'Đã kết thúc'}
      </span>
      <h2 id="contest-status-title">
        {phase === 'ongoing'
          ? <>Kỳ thi sẽ kết thúc sau <span className={styles.countdown}>{countdownText}</span></>
          : phase === 'upcoming'
            ? <>Bắt đầu trong <span className={styles.countdown}>{countdownText}</span></>
            : 'Cuộc thi đã kết thúc'}
      </h2>
      <p className={styles.statusDescription}>
        {phase === 'past'
          ? <>Kết thúc lúc {formatLocalDateTime(contest.endsAt)} <span aria-hidden="true">•</span> Thời gian thi: {getContestDurationMinutes(contest)} phút</>
          : <>Thời gian thi: {getContestDurationMinutes(contest)} phút <span aria-hidden="true">•</span> Bắt đầu lúc {formatLocalDateTime(contest.startsAt)}</>}
        <span aria-hidden="true">•</span> {contest.participantCount.toLocaleString('vi-VN')} thành viên đã đăng ký
      </p>
      {contest.description ? <p className={styles.contestDescription}>{contest.description}</p> : null}
      {contest.rules ? (
        <section className={styles.rules} aria-labelledby="contest-rules-title">
          <h3 id="contest-rules-title">Thể lệ</h3>
          <p>{contest.rules}</p>
        </section>
      ) : null}
    </section>
  )
}

function ContestProblemsTable({ contest }: { contest: StudentContestDetail }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const pageProblems = contest.problems.slice((page - 1) * pageSize, page * pageSize)
  const hasProblemAccess = contest.isRegistered && contest.timeStatus === 'ONGOING'
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: contest.problems.length,
    pageSizes: submissionPageSizes,
    label: 'bài tập cuộc thi',
    summaryLabel: 'bài tập',
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={styles.problemsCard} aria-labelledby="contest-problems-title">
      <header className={styles.problemsHeader}>
        <h2 id="contest-problems-title">Danh sách bài tập</h2>
        <span>{contest.problems.length} bài</span>
      </header>
      {hasProblemAccess ? (
        <>
          <div className={styles.paginationTop}>
            <SubmissionPagination {...paginationProps} showPageSize={false} />
          </div>
          {pageProblems.length === 0 ? (
            <div className={styles.empty}>
              <strong>Chưa có bài tập trong cuộc thi</strong>
              <p>Hiện chưa có bài tập nào được cung cấp.</p>
            </div>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Danh sách bài tập cuộc thi" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.numberColumn}>STT</th>
                    <th scope="col" className={styles.lockColumn}>TRẠNG THÁI</th>
                    <th scope="col" className={styles.problemColumn}>TÊN BÀI TẬP</th>
                    <th scope="col" className={styles.scoreColumn}>ĐIỂM</th>
                  </tr>
                </thead>
                <tbody>
                  {pageProblems.map((problem: StudentContestProblem, index) => (
                    <tr key={problem.problemId}>
                      <td className={styles.numberCell}>{(page - 1) * pageSize + index + 1}</td>
                      <td className={styles.lockCell}>Đã mở</td>
                      <td className={styles.problemCell}>
                        <Link
                          className={styles.problemLink}
                          to={`/contests/${encodeURIComponent(contest.slug)}/problems/${encodeURIComponent(problem.problemCode)}`}
                        >
                          {problem.problemTitle}
                        </Link>
                        <span className={styles.problemCode}>{problem.problemCode}</span>
                      </td>
                      <td className={styles.scoreCell}>{problem.maxScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.paginationBottom}>
            <SubmissionPagination {...paginationProps} />
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <strong>Danh sách bài chưa được mở</strong>
          <p>Chỉ thí sinh đã đăng ký mới xem được bài trong thời gian diễn ra cuộc thi.</p>
        </div>
      )}
    </section>
  )
}

function UnsupportedContestTab({ tabId }: { tabId: ContestTabId }) {
  const tab = tabs.find(({ id }) => id === tabId)!
  const Icon = tab.Icon
  return (
    <section className={styles.placeholder}>
      <span className={styles.placeholderIcon} aria-hidden="true">
        <Icon size={24} />
      </span>
      <h2>{tab.label}</h2>
      <p>Dữ liệu cho mục này chưa được hỗ trợ.</p>
    </section>
  )
}

function ContestDetailPage() {
  const { contestId } = useParams()
  const { accessToken, user, request: authRequest, isLoading: isAuthLoading } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const now = useCurrentTime()
  const [activeTab, setActiveTab] = useState<ContestTabId>('info')
  const [registrationPending, setRegistrationPending] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; contest: StudentContestDetail } | null>(null)
  const [settled, setSettled] = useState<{ key: string; error: string; notFound: boolean } | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const requester: StudentContestRequester = accessToken ? authRequest : publicRequest
  const requestKey = JSON.stringify([contestId, Boolean(accessToken), retryKey])
  const isLoading = isAuthLoading || settled?.key !== requestKey
  const contest = loaded?.key === requestKey ? loaded.contest : null
  const error = settled?.key === requestKey ? settled.error : ''
  const notFound = settled?.key === requestKey && settled.notFound

  useEffect(() => {
    if (!contestId || isAuthLoading) return
    const controller = new AbortController()
    const load = accessToken
      ? getStudentContest(requester, contestId, controller.signal).catch((requestError: unknown) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          return getStudentContest(publicRequest, contestId, controller.signal)
        }
        throw requestError
      })
      : getStudentContest(requester, contestId, controller.signal)

    load
      .then((response) => {
        if (controller.signal.aborted) return
        setLoaded({ key: requestKey, contest: response })
        setSettled({ key: requestKey, error: '', notFound: false })
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setSettled({
          key: requestKey,
          error: requestError instanceof ApiError
            ? requestError.message
            : 'Không thể tải thông tin cuộc thi. Vui lòng thử lại.',
          notFound: requestError instanceof ApiError && requestError.status === 404,
        })
      })
    return () => controller.abort()
  }, [accessToken, contestId, isAuthLoading, requestKey, requester])

  async function handleRegistrationAction() {
    if (!contest || registrationPending) return
    const canCancel = contest.isRegistered && contest.timeStatus === 'UPCOMING'
    const canRegister = contest.canRegister
    if (!canCancel && !canRegister) return

    if (!user || !accessToken) {
      showToast('Vui lòng đăng nhập để đăng ký cuộc thi.')
      navigate(buildLoginPath(`${location.pathname}${location.search}${location.hash}`))
      return
    }

    setRegistrationPending(true)
    try {
      const registration = canCancel
        ? await cancelStudentContestRegistration(authRequest, contest.id)
        : await registerForStudentContest(authRequest, contest.id)
      const isRegistered = registration.registrationStatus === 'REGISTERED'
      const countChange = Number(isRegistered) - Number(contest.isRegistered)
      const optimisticContest = {
        ...contest,
        isRegistered,
        registrationStatus: registration.registrationStatus,
        canRegister: !isRegistered && contest.canRegister,
        participantCount: Math.max(0, contest.participantCount + countChange),
      }
      setLoaded({ key: requestKey, contest: optimisticContest })

      let refreshFailed = false
      try {
        const refreshed = await getStudentContest(authRequest, contest.id)
        setLoaded({ key: requestKey, contest: refreshed })
      } catch {
        refreshFailed = true
      }
      showToast(refreshFailed
        ? isRegistered
          ? 'Đã đăng ký; số thành viên có thể chưa được làm mới.'
          : 'Đã hủy đăng ký; số thành viên có thể chưa được làm mới.'
        : isRegistered
          ? 'Đăng ký cuộc thi thành công.'
          : 'Đã hủy đăng ký cuộc thi.')
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        navigate(buildLoginPath(`${location.pathname}${location.search}${location.hash}`))
      } else if (requestError instanceof ApiError) {
        showToast(requestError.message)
      } else {
        showToast('Không thể cập nhật đăng ký cuộc thi. Vui lòng thử lại.')
      }
    } finally {
      setRegistrationPending(false)
    }
  }

  const handleParticipantsCountChange = useCallback((participantCount: number) => {
    setLoaded((current) => {
      if (!current || current.contest.participantCount === participantCount) return current
      return {
        ...current,
        contest: { ...current.contest, participantCount },
      }
    })
  }, [])

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return

    event.preventDefault()
    setActiveTab(tabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  if (isLoading) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <section className={styles.placeholder} role="status" aria-live="polite">
            <h1>Đang tải cuộc thi…</h1>
          </section>
        </div>
      </main>
    )
  }

  if (!contest) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <section className={styles.notFound} role={notFound ? undefined : 'alert'}>
            <h1>{notFound ? 'Không tìm thấy cuộc thi' : 'Không thể tải cuộc thi'}</h1>
            <p>
              {notFound
                ? 'Cuộc thi không tồn tại hoặc không được công khai.'
                : error || 'Vui lòng thử lại sau.'}
            </p>
            {!notFound ? (
              <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
                Thử lại
              </button>
            ) : null}
            <Link to="/contests">Quay lại danh sách cuộc thi</Link>
          </section>
        </div>
      </main>
    )
  }

  const phase = getPhaseFromStatus(contest.timeStatus)
  const canCancel = contest.isRegistered && contest.timeStatus === 'UPCOMING'
  const canRegister = contest.canRegister
  const actionLabel = canRegister
    ? 'Đăng ký'
    : canCancel
      ? 'Hủy đăng ký'
      : contest.isRegistered
        ? 'Đã đăng ký'
        : contest.timeStatus === 'UPCOMING'
          ? 'Đăng ký đã đóng'
          : phase === 'past'
            ? 'Đã kết thúc'
            : 'Cuộc thi đang diễn ra'
  const isActionEnabled = canRegister || canCancel

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>{contest.title}</h1>
          <div className={styles.navigationRow}>
            <div className={styles.tabsViewport}>
              <div className={styles.tabs} role="tablist" aria-label="Thông tin cuộc thi">
                {tabs.map(({ id, label, Icon }, index) => (
                  <button
                    key={id}
                    ref={(element) => { tabRefs.current[index] = element }}
                    id={`contest-tab-${id}`}
                    className={`${styles.tab} ${activeTab === id ? styles.activeTab : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    aria-controls={`contest-panel-${id}`}
                    tabIndex={activeTab === id ? 0 : -1}
                    onClick={() => setActiveTab(id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}{id === 'participants' ? ` (${contest.participantCount})` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              className={styles.joinButton}
              type="button"
              onClick={() => void handleRegistrationAction()}
              disabled={!isActionEnabled || registrationPending}
              aria-busy={registrationPending}
            >
              {canCancel
                ? <RotateCcw size={17} aria-hidden="true" />
                : phase === 'past'
                  ? <RotateCcw size={17} aria-hidden="true" />
                  : contest.timeStatus === 'UPCOMING'
                    ? <UserRoundPlus size={17} aria-hidden="true" />
                    : <LogIn size={17} aria-hidden="true" />}
              <span>{registrationPending ? 'Đang cập nhật…' : actionLabel}</span>
            </button>
          </div>
        </header>

        <div
          id={`contest-panel-${activeTab}`}
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby={`contest-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'info' ? (
            <div className={styles.infoContent}>
              <ContestCountdown contest={contest} now={now} />
              <ContestProblemsTable contest={contest} />
            </div>
          ) : activeTab === 'stats' ? (
            <ContestStatisticsTab identifier={contest.slug} requester={requester} />
          ) : activeTab === 'ranking' ? (
            <ContestLeaderboardTab contestId={contest.slug} requester={requester} />
          ) : activeTab === 'submissions' ? (
            <SubmissionsContent contestIdentifier={contest.slug} requester={requester} />
          ) : activeTab === 'participants' ? (
            <ContestParticipantsTab
              contestIdentifier={contest.slug}
              participantCount={contest.participantCount}
              requester={requester}
              onParticipantCountChange={handleParticipantsCountChange}
            />
          ) : (
            <UnsupportedContestTab tabId={activeTab} />
          )}
        </div>
      </div>
    </main>
  )
}

export default ContestDetailPage
