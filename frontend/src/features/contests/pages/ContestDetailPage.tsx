import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ChartColumn,
  FileCode,
  Info,
  Lock,
  LockOpen,
  LogIn,
  RotateCcw,
  Trophy,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useToast } from '../../../components/ui/toast-context'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import SubmissionsContent from '../../submissions/components/SubmissionsContent'
import {
  getContestActionLabel,
  getContestById,
  getCountdownParts,
  paginateContests,
  type Contest,
} from '../data'
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

function useCurrentTime(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return now
}

function getContestPhase(contest: Contest, now: number): ContestPhase {
  const start = new Date(contest.startTime).getTime()
  const end = new Date(contest.endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || now >= end) return 'past'
  return now < start ? 'upcoming' : 'ongoing'
}

function padTime(value: number): string {
  return String(value).padStart(2, '0')
}

const localDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function formatLocalDateTime(value: string): string {
  const parts = Object.fromEntries(
    localDateFormatter.formatToParts(new Date(value)).map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.hour}:${parts.minute}:${parts.second} ngày ${parts.day}/${parts.month}/${parts.year}`
}

function ContestCountdown({ contest, now }: { contest: Contest; now: number }) {
  const phase = getContestPhase(contest, now)
  const targetTime = phase === 'upcoming' ? contest.startTime : contest.endTime
  const countdown = getCountdownParts(targetTime, now)
  const countdownText = `${countdown.days} ngày ${padTime(countdown.hours)}:${padTime(countdown.minutes)}:${padTime(countdown.seconds)}`

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
          ? <>Kết thúc lúc {formatLocalDateTime(contest.endTime)} <span aria-hidden="true">•</span> Thời gian làm bài: {contest.durationMinutes} phút</>
          : <>Thời gian làm bài: {contest.durationMinutes} phút <span aria-hidden="true">•</span> Bắt đầu lúc {formatLocalDateTime(contest.startTime)}</>}
      </p>
    </section>
  )
}

function ContestProblemsTable({ contest }: { contest: Contest }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const pageProblems = paginateContests(contest.problems, page, pageSize)
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
      <div className={styles.paginationTop}>
        <SubmissionPagination {...paginationProps} showPageSize={false} />
      </div>
      {pageProblems.length === 0 ? (
        <div className={styles.empty}>
          <strong>Chưa có bài tập trong cuộc thi</strong>
          <p>Danh sách bài tập sẽ được cập nhật khi có dữ liệu.</p>
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="Danh sách bài tập cuộc thi" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.numberColumn}>STT</th>
                <th scope="col" className={styles.lockColumn}><Lock size={16} aria-label="Trạng thái khóa" /></th>
                <th scope="col" className={styles.problemColumn}>TÊN BÀI TẬP</th>
                <th scope="col" className={styles.scoreColumn}>ĐIỂM</th>
              </tr>
            </thead>
            <tbody>
              {pageProblems.map((problem, index) => (
                <tr key={problem.id}>
                  <td className={styles.numberCell}>{(page - 1) * pageSize + index + 1}</td>
                  <td className={styles.lockCell}>
                    {problem.isLocked ? (
                      <Lock size={17} role="img" aria-label="Đề bài đang khóa" />
                    ) : (
                      <LockOpen size={17} role="img" aria-label="Đề bài đã mở khóa" />
                    )}
                  </td>
                  <td className={styles.problemCell}>
                    {problem.isLocked ? (
                      <span className={styles.lockedProblem} aria-label={`${problem.title}, đang khóa`}>
                        {problem.title}
                      </span>
                    ) : (
                      <Link
                        className={styles.problemLink}
                        to={`/problems/${encodeURIComponent(problem.code)}`}
                      >
                        {problem.title}
                      </Link>
                    )}
                    <span className={styles.problemCode}>{problem.code}</span>
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
    </section>
  )
}

function ContestDetailPage() {
  const { contestId } = useParams()
  const contest = contestId ? getContestById(contestId) : undefined
  const { showToast } = useToast()
  const now = useCurrentTime()
  const [activeTab, setActiveTab] = useState<ContestTabId>('info')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  if (!contest) {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <section className={styles.notFound}>
            <h1>Không tìm thấy cuộc thi</h1>
            <p>Cuộc thi có thể không tồn tại hoặc đã bị gỡ khỏi dữ liệu mẫu.</p>
            <Link to="/contests">Quay lại danh sách cuộc thi</Link>
          </section>
        </div>
      </main>
    )
  }

  const phase = getContestPhase(contest, now)
  const actionLabel = getContestActionLabel(phase)

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
              onClick={() => showToast('Chức năng đang phát triển.')}
            >
              {phase === 'upcoming'
                ? <UserRoundPlus size={17} aria-hidden="true" />
                : phase === 'past'
                ? <RotateCcw size={17} aria-hidden="true" />
                  : <LogIn size={17} aria-hidden="true" />}
              <span>{actionLabel}</span>
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
            <ContestStatisticsTab contest={contest} />
          ) : activeTab === 'ranking' ? (
            <ContestLeaderboardTab contestId={contest.id} problemCount={contest.problems.length} />
          ) : activeTab === 'submissions' ? (
            <SubmissionsContent key={contest.id} contest={contest} />
          ) : activeTab === 'participants' ? (
            <ContestParticipantsTab key={contest.id} contest={contest} />
          ) : (
            <section className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden="true">
                {activeTab === 'participants' ? <Users size={24} /> : <FileCode size={24} />}
              </span>
              <h2>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
              <p>Đang phát triển</p>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

export default ContestDetailPage
