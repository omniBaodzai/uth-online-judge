import { describe, expect, it } from 'vitest'
import {
  buildActivityCalendar,
  formatActivityDate,
  getActivityDateKey,
} from './profile-activity'

describe('profile activity calendar', () => {
  it('places each date in the correct Monday-first week and weekday row', () => {
    const calendar = buildActivityCalendar(
      [{ date: '2026-01-01', count: 3 }],
      new Date('2026-01-04T12:00:00.000Z'),
    )

    expect(calendar.days.map((day) => day.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ])
    expect(calendar.weeks[0]?.days.slice(0, 3)).toEqual([null, null, null])
    expect(calendar.weeks[0]?.days[3]).toMatchObject({
      date: '2026-01-01',
      count: 3,
      level: 2,
    })
  })

  it('aligns month labels with the week columns containing each month start', () => {
    const calendar = buildActivityCalendar(
      [],
      new Date('2026-03-10T12:00:00.000Z'),
    )

    expect(calendar.months.slice(0, 3)).toEqual([
      { label: 'Th1', weekIndex: 0 },
      { label: 'Th2', weekIndex: 4 },
      { label: 'Th3', weekIndex: 8 },
    ])
    expect(calendar.months).toHaveLength(12)
  })

  it('places 2026 dates in the expected weeks and excludes future days', () => {
    const calendar = buildActivityCalendar(
      [{ date: '2026-11-04', count: 8 }],
      new Date('2026-11-03T15:34:00.000Z'),
    )

    expect(calendar.days).toHaveLength(307)
    expect(calendar.weeks).toHaveLength(53)
    expect(calendar.weeks.every((week) => week.days.length === 7)).toBe(true)
    expect(calendar.weeks[0]?.days[3]?.date).toBe('2026-01-01')
    expect(calendar.weeks[44]?.days[1]).toMatchObject({
      date: '2026-11-03',
      count: 0,
    })
    expect(calendar.weeks[44]?.days[2]).toEqual({
      date: '2026-11-04',
      future: true,
    })
    expect(calendar.weeks[45]?.days.every((day) => day === null || ('future' in day))).toBe(true)
    expect(calendar.weeks[52]?.days.every((day) => day === null || ('future' in day))).toBe(true)
    expect(calendar.days.at(-1)?.date).toBe('2026-11-03')
    expect(calendar.weeks[52]?.days[3]?.date).toBe('2026-12-31')
    expect(calendar.weeks[52]?.days.slice(4)).toEqual([null, null, null])
    expect(calendar.months.at(-1)).toEqual({ label: 'Th12', weekIndex: 48 })
    expect(calendar.days.some((day) => day.date === '2026-11-04')).toBe(false)
    expect(calendar.days.reduce((total, day) => total + day.count, 0)).toBe(0)
  })

  it('includes February 29 in leap years and maps the following date correctly', () => {
    const calendar = buildActivityCalendar(
      [{ date: '2024-02-29', count: 5 }],
      new Date('2024-03-01T12:00:00.000Z'),
    )

    expect(calendar.days).toHaveLength(61)
    expect(calendar.days.at(-2)).toMatchObject({ date: '2024-02-29', count: 5, level: 3 })
    expect(calendar.days.at(-1)?.date).toBe('2024-03-01')
  })

  it('uses the configured timezone to determine the calendar date', () => {
    const instant = new Date('2025-12-31T17:30:00.000Z')

    expect(getActivityDateKey(instant, 'UTC')).toBe('2025-12-31')
    expect(getActivityDateKey(instant, 'Asia/Ho_Chi_Minh')).toBe('2026-01-01')
    expect(buildActivityCalendar([], instant, 'UTC').year).toBe(2025)
    expect(buildActivityCalendar([], instant).year).toBe(2026)
    expect(getActivityDateKey(new Date('2026-11-03T18:00:00.000Z'))).toBe('2026-11-04')
  })

  it('maps submissions just before and after Vietnam midnight to the correct date', () => {
    expect(getActivityDateKey(new Date('2026-11-03T16:59:00.000Z'))).toBe('2026-11-03')
    expect(getActivityDateKey(new Date('2026-11-03T17:01:00.000Z'))).toBe('2026-11-04')
    expect(getActivityDateKey(new Date('2026-11-03T18:00:00.000Z'))).toBe('2026-11-04')
  })

  it('rolls the activity year over at Vietnam midnight on January 1', () => {
    const calendar = buildActivityCalendar(
      [
        { date: '2025-12-31', count: 3 },
        { date: '2026-01-01', count: 2 },
      ],
      new Date('2025-12-31T17:01:00.000Z'),
    )

    expect(calendar.year).toBe(2026)
    expect(calendar.days[0]).toMatchObject({ date: '2026-01-01', count: 2 })
    expect(calendar.days.some((day) => day.date === '2025-12-31')).toBe(false)
  })

  it('uses only supplied activity counts and keeps dates without records at zero', () => {
    const calendar = buildActivityCalendar(
      [
        { date: '2026-01-01', count: 1 },
        { date: '2026-01-01', count: 2 },
        { date: '2026-01-03', count: 7 },
        { date: '2026-01-05', count: 9 },
      ],
      new Date('2026-01-03T12:00:00.000Z'),
    )

    expect(calendar.days.map(({ date, count, level }) => ({ date, count, level }))).toEqual([
      { date: '2026-01-01', count: 3, level: 2 },
      { date: '2026-01-02', count: 0, level: 0 },
      { date: '2026-01-03', count: 7, level: 4 },
    ])
  })

  it('keeps past empty dates and active dates interactive while future dates are separate', () => {
    const calendar = buildActivityCalendar(
      [
        { date: '2026-11-02', count: 0 },
        { date: '2026-11-03', count: 4 },
        { date: '2026-11-04', count: 100 },
      ],
      new Date('2026-11-03T16:00:00.000Z'),
    )

    const yesterday = calendar.days.find((day) => day.date === '2026-11-02')
    const today = calendar.days.find((day) => day.date === '2026-11-03')
    const future = calendar.weeks.flatMap((week) => week.days)
      .find((day) => day && 'future' in day && day.date === '2026-11-04')

    expect(yesterday).toMatchObject({ date: '2026-11-02', count: 0, level: 0 })
    expect(today).toMatchObject({ date: '2026-11-03', count: 4, level: 3 })
    expect(future).toEqual({ date: '2026-11-04', future: true })
    expect(calendar.days.reduce((total, day) => total + day.count, 0)).toBe(4)
  })

  it('builds a zero-activity calendar when the API returns no records', () => {
    const calendar = buildActivityCalendar([], new Date('2026-11-03T16:00:00.000Z'))

    expect(calendar.days.length).toBe(307)
    expect(calendar.days.every((day) => day.count === 0)).toBe(true)
  })

  it('formats tooltip dates with weekday, full date, and year', () => {
    expect(formatActivityDate('2026-01-01')).toBe('Thứ Năm, 1 tháng 1, 2026')
    expect(formatActivityDate('2026-11-03')).toBe('Thứ Ba, 3 tháng 11, 2026')
  })

  it('shows only months through the current date and handles the final calendar day', () => {
    const calendar = buildActivityCalendar(
      [{ date: '2025-12-31', count: 1 }],
      new Date('2025-12-31T16:59:00.000Z'),
    )

    expect(calendar.days).toHaveLength(365)
    expect(calendar.days.at(-1)).toMatchObject({ date: '2025-12-31', count: 1 })
    expect(calendar.months).toHaveLength(12)
  })

  it('places the last day of a leap year in the correct week and weekday', () => {
    const calendar = buildActivityCalendar(
      [{ date: '2024-12-31', count: 2 }],
      new Date('2024-12-31T16:59:00.000Z'),
    )

    expect(calendar.days).toHaveLength(366)
    expect(calendar.weeks).toHaveLength(53)
    expect(calendar.weeks.at(-1)?.days[1]?.date).toBe('2024-12-31')
    expect(calendar.months.at(-1)).toEqual({ label: 'Th12', weekIndex: 47 })
  })
})
