import type { Contest } from '../data'
import { formatContestDate } from '../data'
import styles from './ContestsCalendar.module.css'

type ContestsCalendarProps = {
  contests: Contest[]
  month: Date
  onMonthChange: (month: Date) => void
  onVirtualParticipate: (contest: Contest) => void
}

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function ContestsCalendar({ contests, month, onMonthChange, onVirtualParticipate }: ContestsCalendarProps) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days = Array.from({ length: offset + daysInMonth }, (_, index) => index < offset ? null : index - offset + 1)
  const contestsByDay = new Map<number, Contest[]>()

  contests.forEach((contest) => {
    const date = new Date(contest.startsAt)
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return
    const existing = contestsByDay.get(date.getDate()) ?? []
    existing.push(contest)
    contestsByDay.set(date.getDate(), existing)
  })

  function shiftMonth(delta: number) {
    onMonthChange(new Date(year, monthIndex + delta, 1))
  }

  return (
    <section className={styles.calendar} aria-label="Lịch các kỳ thi">
      <div className={styles.calendarHeader}>
        <div>
          <p>LỊCH THI</p>
          <h2>{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(month)}</h2>
        </div>
        <div className={styles.monthControls}>
          <button type="button" aria-label="Tháng trước" onClick={() => shiftMonth(-1)}>‹</button>
          <button type="button" aria-label="Tháng sau" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </div>
      <div className={styles.weekdays}>
        {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className={styles.daysGrid}>
        {days.map((day, index) => {
          const dayContests = day === null ? [] : contestsByDay.get(day) ?? []
          return (
            <div className={`${styles.day} ${day === null ? styles.blankDay : ''}`} key={`${day ?? 'blank'}-${index}`}>
              {day !== null && <span className={styles.dayNumber}>{day}</span>}
              {dayContests.map((contest) => (
                <button
                  className={styles.calendarContest}
                  key={contest.id}
                  type="button"
                  title={`${contest.name} · ${formatContestDate(contest.startsAt)}`}
                  onClick={() => onVirtualParticipate(contest)}
                >
                  <span className={styles.eventDot} />
                  <span>{contest.name}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <p className={styles.calendarNote}>Chọn kỳ thi để xem thông tin và tham gia ảo.</p>
    </section>
  )
}

export default ContestsCalendar