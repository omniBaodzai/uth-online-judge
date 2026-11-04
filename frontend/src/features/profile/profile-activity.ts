export const PROFILE_ACTIVITY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const DAY_MS = 24 * 60 * 60 * 1000

export type ActivityRecord = { date: string; count: number }
export type ActivityDay = ActivityRecord & { level: 0 | 1 | 2 | 3 | 4 }
export type ActivityFutureDay = { date: string; future: true }
export type ActivityCalendarWeek = {
  index: number
  days: (ActivityDay | ActivityFutureDay | null)[]
}
export type ActivityMonthLabel = {
  label: string
  weekIndex: number
}
export type ActivityCalendar = {
  year: number
  days: ActivityDay[]
  weeks: ActivityCalendarWeek[]
  months: ActivityMonthLabel[]
}

function activityLevel(count: number): ActivityDay['level'] {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

export function getActivityDateKey(
  date: Date,
  timeZone = PROFILE_ACTIVITY_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((value) => value.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatActivityDate(date: string, locale = 'vi-VN'): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    timeZone: PROFILE_ACTIVITY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12)))
}

export function buildActivityCalendar(
  activity: ActivityRecord[],
  now = new Date(),
  timeZone = PROFILE_ACTIVITY_TIME_ZONE,
): ActivityCalendar {
  const todayKey = getActivityDateKey(now, timeZone)
  const year = Number(todayKey.slice(0, 4))
  const start = Date.UTC(year, 0, 1)
  const end = Date.parse(`${todayKey}T00:00:00.000Z`)
  const dayCount = Math.floor((end - start) / DAY_MS) + 1
  const yearDayCount = (Date.UTC(year + 1, 0, 1) - start) / DAY_MS
  const leadingDays = (new Date(start).getUTCDay() + 6) % 7
  const weekCount = Math.ceil((leadingDays + yearDayCount) / 7)
  const counts = new Map<string, number>()
  const yearStartKey = `${year}-01-01`

  for (const record of activity) {
    if (record.date < yearStartKey || record.date > todayKey) continue
    counts.set(record.date, (counts.get(record.date) ?? 0) + record.count)
  }

  const days: ActivityDay[] = []
  const weeks: ActivityCalendarWeek[] = []

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekDays: (ActivityDay | ActivityFutureDay | null)[] = []
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const dayIndex = weekIndex * 7 + weekday - leadingDays
      if (dayIndex < 0 || dayIndex >= yearDayCount) {
        weekDays.push(null)
        continue
      }

      const date = new Date(start + dayIndex * DAY_MS).toISOString().slice(0, 10)
      if (dayIndex >= dayCount) {
        weekDays.push({ date, future: true })
        continue
      }

      const count = counts.get(date) ?? 0
      const day = { date, count, level: activityLevel(count) }
      days.push(day)
      weekDays.push(day)
    }
    weeks.push({ index: weekIndex, days: weekDays })
  }

  const months: ActivityMonthLabel[] = []
  for (let month = 0; month < 12; month += 1) {
    const monthStart = Date.UTC(year, month, 1)
    const dayIndex = Math.floor((monthStart - start) / DAY_MS)
    months.push({
      label: `Th${month + 1}`,
      weekIndex: Math.floor((leadingDays + dayIndex) / 7),
    })
  }

  return { year, days, weeks, months }
}
