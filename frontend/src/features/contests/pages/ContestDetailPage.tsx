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
import { useContestText } from '../translate'
import styles from './ContestDetailPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]
const tabs = [
  { id: 'info', labelKey: 'tabInfo', Icon: Info },
  { id: 'stats', labelKey: 'tabStatistics', Icon: ChartColumn },
  { id: 'ranking', labelKey: 'tabLeaderboard', Icon: Trophy },
  { id: 'participants', labelKey: 'tabParticipants', Icon: Users },
  { id: 'submissions', labelKey: 'tabSubmissions', Icon: FileCode },
] as const

type ContestTabId = (typeof tabs)[number]['id']
type ContestPhase = 'ongoing' | 'upcoming' | 'past'

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

function padTime(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(value)
}

function formatLocalDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function getContestDurationMinutes(contest: StudentContestDetail): number {
  return Math.max(0, Math.round(
    (new Date(contest.endsAt).getTime() - new Date(contest.startsAt).getTime()) / 60_000,
  ))
}

function ContestCountdown({ contest, now }: { contest: StudentContestDetail; now: number }) {
  const { text, locale } = useContestText()
  const phase = getPhaseFromStatus(contest.timeStatus)
  const targetTime = phase === 'upcoming' ? contest.startsAt : contest.endsAt
  const targetTimestamp = new Date(targetTime).getTime()
  const remainingSeconds = Number.isFinite(targetTimestamp)
    ? Math.max(0, Math.floor((targetTimestamp - now) / 1000))
    : 0
  const countdownText = `${Math.floor(remainingSeconds / 86_400).toLocaleString(locale)} ${text('days', 'ngày', 'days')} ${padTime(Math.floor((remainingSeconds % 86_400) / 3_600), locale)}:${padTime(Math.floor((remainingSeconds % 3_600) / 60), locale)}:${padTime(remainingSeconds % 60, locale)}`

  return (
    <section className={styles.statusCard} aria-labelledby="contest-status-title">
      <span className={`${styles.statusBadge} ${styles[phase]}`}>
        <span className={styles.statusDot} aria-hidden="true" />
        {phase === 'ongoing' ? text('ongoing', 'Đang diễn ra', 'Ongoing') : phase === 'upcoming' ? text('upcoming', 'Sắp diễn ra', 'Upcoming') : text('ended', 'Đã kết thúc', 'Ended')}
      </span>
      <h2 id="contest-status-title">
        {phase === 'ongoing'
          ? <>{text('contestEndsIn', 'Kỳ thi sẽ kết thúc sau', 'Contest ends in')} <span className={styles.countdown}>{countdownText}</span></>
          : phase === 'upcoming'
            ? <>{text('startsIn', 'Bắt đầu trong', 'Starts in')} <span className={styles.countdown}>{countdownText}</span></>
            : text('contestEnded', 'Cuộc thi đã kết thúc', 'The contest has ended')}
      </h2>
      <p className={styles.statusDescription}>
        {phase === 'past'
          ? <>{text('endsAt', 'Kết thúc lúc', 'Ended at')} {formatLocalDateTime(contest.endsAt, locale)} <span aria-hidden="true">•</span> {text('durationLabel', 'Thời gian thi:', 'Duration:')} {getContestDurationMinutes(contest).toLocaleString(locale)} {text('minutes', 'phút', 'minutes')}</>
          : <>{text('durationLabel', 'Thời gian thi:', 'Duration:')} {getContestDurationMinutes(contest).toLocaleString(locale)} {text('minutes', 'phút', 'minutes')} <span aria-hidden="true">•</span> {text('startsAt', 'Bắt đầu lúc', 'Starts at')} {formatLocalDateTime(contest.startsAt, locale)}</>}
        <span aria-hidden="true">•</span> {text('registeredMembersCount', '{{count}} thành viên đã đăng ký', '{{count}} members registered', {
          count: contest.participantCount.toLocaleString(locale),
        })}
      </p>
      {contest.description ? <p className={styles.contestDescription}>{contest.description}</p> : null}
      {contest.rules ? (
        <section className={styles.rules} aria-labelledby="contest-rules-title">
          <h3 id="contest-rules-title">{text('contestRules', 'Thể lệ', 'Rules')}</h3>
          <p>{contest.rules}</p>
        </section>
      ) : null}
    </section>
  )
}

function ContestProblemsTable({ contest }: { contest: StudentContestDetail }) {
  const { text, locale } = useContestText()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const pageProblems = contest.problems.slice((page - 1) * pageSize, page * pageSize)
  const hasProblemAccess = contest.isRegistered && contest.timeStatus === 'ONGOING'
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems: contest.problems.length,
    pageSizes: submissionPageSizes,
    label: text('contestProblems', 'bài tập cuộc thi', 'contest problems'),
    summaryLabel: text('problems', 'bài tập', 'problems'),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <section className={styles.problemsCard} aria-labelledby="contest-problems-title">
      <header className={styles.problemsHeader}>
        <h2 id="contest-problems-title">{text('problemListTitle', 'Danh sách bài tập', 'Problem list')}</h2>
        <span>{contest.problems.length.toLocaleString(locale)} {text('problemsShort', 'bài', 'problems')}</span>
      </header>
      {hasProblemAccess ? (
        <>
          <div className={styles.paginationTop}>
            <SubmissionPagination {...paginationProps} showPageSize={false} />
          </div>
          {pageProblems.length === 0 ? (
            <div className={styles.empty}>
              <strong>{text('noContestProblems', 'Chưa có bài tập trong cuộc thi', 'No problems in this contest yet')}</strong>
              <p>{text('noContestProblemsHint', 'Hiện chưa có bài tập nào được cung cấp.', 'No problems have been added yet.')}</p>
            </div>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label={text('contestProblemTableLabel', 'Danh sách bài tập cuộc thi', 'Contest problem list')} tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.numberColumn}>{text('number', 'STT', 'NO.')}</th>
                    <th scope="col" className={styles.lockColumn}>{text('status', 'TRẠNG THÁI', 'STATUS')}</th>
                    <th scope="col" className={styles.problemColumn}>{text('problemName', 'TÊN BÀI TẬP', 'PROBLEM')}</th>
                    <th scope="col" className={styles.scoreColumn}>{text('score', 'ĐIỂM', 'SCORE')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageProblems.map((problem: StudentContestProblem, index) => (
                    <tr key={problem.problemId}>
                      <td className={styles.numberCell}>{((page - 1) * pageSize + index + 1).toLocaleString(locale)}</td>
                      <td className={styles.lockCell}>{text('unlocked', 'Đã mở', 'Unlocked')}</td>
                      <td className={styles.problemCell}>
                        <Link
                          className={styles.problemLink}
                          to={`/contests/${encodeURIComponent(contest.slug)}/problems/${encodeURIComponent(problem.problemCode)}`}
                        >
                          {problem.problemTitle}
                        </Link>
                        <span className={styles.problemCode}>{problem.problemCode}</span>
                      </td>
                      <td className={styles.scoreCell}>{problem.maxScore.toLocaleString(locale)}</td>
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
          <strong>{text('problemsLocked', 'Danh sách bài chưa được mở', 'Problems are not available yet')}</strong>
          <p>{text('problemsLockedHint', 'Chỉ thí sinh đã đăng ký mới xem được bài trong thời gian diễn ra cuộc thi.', 'Only registered contestants can view problems while the contest is ongoing.')}</p>
        </div>
      )}
    </section>
  )
}

function UnsupportedContestTab({ tabId }: { tabId: ContestTabId }) {
  const { text } = useContestText()
  const tab = tabs.find(({ id }) => id === tabId)!
  const Icon = tab.Icon
  return (
    <section className={styles.placeholder}>
      <span className={styles.placeholderIcon} aria-hidden="true">
        <Icon size={24} />
      </span>
      <h2>{text(tab.labelKey, tab.id === 'info' ? 'Thông tin' : tab.id === 'stats' ? 'Thống kê' : tab.id === 'ranking' ? 'Bảng xếp hạng' : tab.id === 'participants' ? 'Tham gia' : 'Các bài nộp', tab.id === 'info' ? 'Information' : tab.id === 'stats' ? 'Statistics' : tab.id === 'ranking' ? 'Leaderboard' : tab.id === 'participants' ? 'Participants' : 'Submissions')}</h2>
      <p>{text('unsupportedTabData', 'Dữ liệu cho mục này chưa được hỗ trợ.', 'Data for this section is not available yet.')}</p>
    </section>
  )
}

function ContestDetailPage() {
  const { text, locale } = useContestText()
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
            : text('contestRequestError', 'Không thể tải thông tin cuộc thi. Vui lòng thử lại.', 'Could not load contest information. Please try again.'),
          notFound: requestError instanceof ApiError && requestError.status === 404,
        })
      })
    return () => controller.abort()
  }, [accessToken, contestId, isAuthLoading, requestKey, requester, text])

  async function handleRegistrationAction() {
    if (!contest || registrationPending) return
    const canCancel = contest.isRegistered && contest.timeStatus === 'UPCOMING'
    const canRegister = contest.canRegister
    if (!canCancel && !canRegister) return

    if (!user || !accessToken) {
      showToast(text('signInToRegister', 'Vui lòng đăng nhập để đăng ký cuộc thi.', 'Sign in to register for the contest.'))
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
          ? text('registeredCountMayBeStale', 'Đã đăng ký; số thành viên có thể chưa được làm mới.', 'You are registered; the participant count may not be up to date.')
          : text('cancelledCountMayBeStale', 'Đã hủy đăng ký; số thành viên có thể chưa được làm mới.', 'Registration cancelled; the participant count may not be up to date.')
        : isRegistered
          ? text('registrationSuccess', 'Đăng ký cuộc thi thành công.', 'Successfully registered for the contest.')
          : text('registrationCancelled', 'Đã hủy đăng ký cuộc thi.', 'Contest registration cancelled.'))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        showToast(text('sessionExpired', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Your session has expired. Please sign in again.'))
        navigate(buildLoginPath(`${location.pathname}${location.search}${location.hash}`))
      } else if (requestError instanceof ApiError) {
        showToast(requestError.message)
      } else {
        showToast(text('registrationUpdateError', 'Không thể cập nhật đăng ký cuộc thi. Vui lòng thử lại.', 'Could not update your contest registration. Please try again.'))
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
            <h1>{text('contestLoading', 'Đang tải cuộc thi…', 'Loading contest…')}</h1>
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
            <h1>{notFound ? text('contestNotFound', 'Không tìm thấy cuộc thi', 'Contest not found') : text('contestLoadError', 'Không thể tải cuộc thi', 'Could not load contest')}</h1>
            <p>
              {notFound
                ? text('contestUnavailable', 'Cuộc thi không tồn tại hoặc không được công khai.', 'This contest does not exist or is not public.')
                : error || text('tryAgainLater', 'Vui lòng thử lại sau.', 'Please try again later.')}
            </p>
            {!notFound ? (
              <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
                {text('retry', 'Thử lại', 'Retry')}
              </button>
            ) : null}
            <Link to="/contests">{text('backToContests', 'Quay lại danh sách cuộc thi', 'Back to contests')}</Link>
          </section>
        </div>
      </main>
    )
  }

  const phase = getPhaseFromStatus(contest.timeStatus)
  const canCancel = contest.isRegistered && contest.timeStatus === 'UPCOMING'
  const canRegister = contest.canRegister
  const actionLabel = canRegister
    ? text('register', 'Đăng ký', 'Register')
    : canCancel
      ? text('cancelRegistration', 'Hủy đăng ký', 'Cancel registration')
      : contest.isRegistered
        ? text('registered', 'Đã đăng ký', 'Registered')
        : contest.timeStatus === 'UPCOMING'
          ? text('registrationClosed', 'Đăng ký đã đóng', 'Registration closed')
          : phase === 'past'
            ? text('ended', 'Đã kết thúc', 'Ended')
            : text('contestOngoing', 'Cuộc thi đang diễn ra', 'Contest is ongoing')
  const isActionEnabled = canRegister || canCancel

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>{contest.title}</h1>
          <div className={styles.navigationRow}>
            <div className={styles.tabsViewport}>
              <div className={styles.tabs} role="tablist" aria-label={text('contestTabsLabel', 'Thông tin cuộc thi', 'Contest information')}>
                {tabs.map(({ id, labelKey, Icon }, index) => (
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
                    <span>{text(labelKey, id === 'info' ? 'Thông tin' : id === 'stats' ? 'Thống kê' : id === 'ranking' ? 'Bảng xếp hạng' : id === 'participants' ? 'Tham gia' : 'Các bài nộp', id === 'info' ? 'Information' : id === 'stats' ? 'Statistics' : id === 'ranking' ? 'Leaderboard' : id === 'participants' ? 'Participants' : 'Submissions')}{id === 'participants' ? ` (${contest.participantCount.toLocaleString(locale)})` : ''}</span>
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
              <span>{registrationPending ? text('registrationUpdating', 'Đang cập nhật…', 'Updating registration…') : actionLabel}</span>
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
