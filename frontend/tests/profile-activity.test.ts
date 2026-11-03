import assert from 'node:assert/strict'
import test from 'node:test'
import { buildActivityCalendar } from '../src/features/profile/profile-activity.ts'

test('builds a year-long activity calendar with empty days retained', () => {
  const calendar = buildActivityCalendar(
    [{ date: '2026-10-29', count: 7 }],
    new Date('2026-10-29T12:00:00Z'),
  )
  assert.equal(calendar.year, 2026)
  assert.equal(calendar.days.length, 302)
  assert.deepEqual(calendar.days.at(-1), { date: '2026-10-29', count: 7, level: 4 })
  assert.ok(calendar.days.some((day) => day.count === 0))
})

test('maps activity intensity into stable heatmap levels', () => {
  const calendar = buildActivityCalendar([
    { date: '2026-10-25', count: 1 },
    { date: '2026-10-26', count: 3 },
    { date: '2026-10-27', count: 5 },
    { date: '2026-10-28', count: 9 },
  ], new Date('2026-10-29T12:00:00Z'))
  const levels = new Map(calendar.days.map(({ date, level }) => [date, level]))
  assert.deepEqual(
    ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map((date) => levels.get(date)),
    [1, 2, 3, 4, 0],
  )
})