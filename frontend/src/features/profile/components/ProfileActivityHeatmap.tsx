import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { buildActivityCalendar, formatActivityDate } from '../profile-activity'
import type { PublicProfile } from '../api'
import styles from './ProfileShowcase.module.css'

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type ActivityTooltip = {
  date: string
  count: number
  left: number
  top: number
  placement: 'above' | 'below'
}

function ProfileActivityHeatmap({ activity }: { activity: PublicProfile['activity'] }) {
  const calendar = buildActivityCalendar(activity)
  const yearlySubmissions = calendar.days.reduce((total, day) => total + day.count, 0)
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<ActivityTooltip | null>(null)
  const tooltipId = useId()
  const dayButtons = useRef(new Map<string, HTMLButtonElement>())
  const focusedDate = useRef<string | null>(null)
  const hoveredDate = useRef<string | null>(null)
  const lastDate = calendar.days.at(-1)?.date
  const tabStopDate = activeDate && calendar.days.some((day) => day.date === activeDate)
    ? activeDate
    : lastDate

  useEffect(() => {
    function dismissTooltip() {
      setTooltip(null)
      hoveredDate.current = null
    }

    window.addEventListener('scroll', dismissTooltip, true)
    window.addEventListener('resize', dismissTooltip)
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true)
      window.removeEventListener('resize', dismissTooltip)
    }
  }, [])

  function showTooltip(
    event: FocusEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>,
    date: string,
    count: number,
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    const halfTooltipWidth = Math.min(130, Math.max(0, (window.innerWidth - 16) / 2))
    const center = Math.max(
      8 + halfTooltipWidth,
      Math.min(window.innerWidth - 8 - halfTooltipWidth, rect.left + rect.width / 2),
    )
    const placement = rect.top > 72 ? 'above' : 'below'

    setTooltip({
      date,
      count,
      left: center,
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      placement,
    })
  }

  function hideTooltip(date: string) {
    if (focusedDate.current === date || hoveredDate.current === date) return
    setTooltip(null)
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const dayIndex = calendar.days.findIndex((day) => day.date === date)
    let offset: number | null = null
    if (event.key === 'ArrowLeft') offset = -7
    else if (event.key === 'ArrowRight') offset = 7
    else if (event.key === 'ArrowUp') offset = -1
    else if (event.key === 'ArrowDown') offset = 1
    else if (event.key === 'Home') offset = -dayIndex
    else if (event.key === 'End') offset = calendar.days.length - 1 - dayIndex

    if (offset === null) return
    event.preventDefault()
    const nextDay = calendar.days[Math.max(0, Math.min(calendar.days.length - 1, dayIndex + offset))]
    if (!nextDay) return
    setActiveDate(nextDay.date)
    dayButtons.current.get(nextDay.date)?.focus()
  }

  return (
    <section className={styles.section} aria-labelledby="activity-title">
      <header className={styles.sectionHeader}>
        <div>
          <h2 id="activity-title">Hoạt động trong năm</h2>
          <p>{calendar.year} · {yearlySubmissions.toLocaleString('vi-VN')} lượt nộp</p>
        </div>
      </header>
      <div className={styles.activityCalendar}>
        <div className={styles.weekdayLabels} aria-hidden="true">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div
          className={styles.heatmapScroll}
          tabIndex={0}
          role="group"
          aria-label={`Hoạt động nộp bài theo ngày trong năm ${calendar.year}. Dùng phím mũi tên để di chuyển giữa các ngày.`}
        >
          <div className={styles.heatmapContent}>
            <div className={styles.monthLabels} aria-hidden="true">
              {calendar.months.map((month) => (
                <span
                  className={styles.monthLabel}
                  key={`${month.label}-${month.weekIndex}`}
                  style={{ left: `${month.weekIndex * 13}px` }}
                >
                  {month.label}
                </span>
              ))}
            </div>
            <div className={styles.heatmap}>
              {calendar.weeks.flatMap((week) =>
                week.days.map((day, weekday) =>
                  day && !('future' in day) ? (
                    <button
                      className={styles.activityDay}
                      data-level={day.level}
                      key={day.date}
                      type="button"
                      tabIndex={day.date === tabStopDate ? 0 : -1}
                      aria-label={`${formatActivityDate(day.date)}, ${day.count} lượt nộp`}
                      aria-describedby={tooltip?.date === day.date ? tooltipId : undefined}
                      ref={(element) => {
                        if (element) dayButtons.current.set(day.date, element)
                        else dayButtons.current.delete(day.date)
                      }}
                      onFocus={(event) => {
                        focusedDate.current = day.date
                        setActiveDate(day.date)
                        showTooltip(event, day.date, day.count)
                      }}
                      onBlur={() => {
                        focusedDate.current = null
                        hideTooltip(day.date)
                      }}
                      onMouseEnter={(event) => {
                        hoveredDate.current = day.date
                        showTooltip(event, day.date, day.count)
                      }}
                      onMouseLeave={() => {
                        hoveredDate.current = null
                        hideTooltip(day.date)
                      }}
                      onKeyDown={(event) => handleDayKeyDown(event, day.date)}
                    />
                  ) : day ? (
                    <span
                      className={styles.activityFutureDay}
                      key={`future-${day.date}`}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className={styles.activityDayPlaceholder}
                      key={`blank-${week.index}-${weekday}`}
                      aria-hidden="true"
                    />
                  ),
                ),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.heatmapLegend} aria-label="Mức độ hoạt động">
        <span>Ít</span>
        {[0, 1, 2, 3, 4].map((level) => <span className={styles.activityDay} data-level={level} key={level} aria-hidden="true" />)}
        <span>Nhiều</span>
      </div>
      {tooltip && createPortal(
        <div
          className={styles.activityTooltip}
          id={tooltipId}
          role="tooltip"
          data-placement={tooltip.placement}
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <strong>{formatActivityDate(tooltip.date)}</strong>
          <span>{tooltip.count.toLocaleString('vi-VN')} lượt nộp</span>
        </div>,
        document.body,
      )}
    </section>
  )
}

export default ProfileActivityHeatmap
