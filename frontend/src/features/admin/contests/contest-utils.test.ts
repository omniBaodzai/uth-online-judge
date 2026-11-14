import { describe, expect, it } from 'vitest'
import {
  formatForDateTimeLocal,
  parseDateTimeLocal,
  parseDateTimeLocalTimestamp,
} from './contest-utils'

describe('contest date-time conversion', () => {
  it('round-trips Vietnam local time through UTC without applying the offset twice', () => {
    const utc = '2026-11-15T02:00:00.000Z'

    expect(formatForDateTimeLocal(utc)).toBe('2026-11-15T09:00')
    expect(parseDateTimeLocal('2026-11-15T09:00')).toBe(utc)
    expect(parseDateTimeLocalTimestamp('2026-11-15T09:00')).toBe(Date.parse(utc))
  })

  it('returns no timestamp for empty or malformed values', () => {
    expect(parseDateTimeLocalTimestamp('')).toBeNull()
    expect(parseDateTimeLocalTimestamp('not-a-date')).toBeNull()
    expect(parseDateTimeLocalTimestamp('2026-02-31T09:00')).toBeNull()
    expect(() => parseDateTimeLocal('not-a-date')).toThrow(RangeError)
  })
})
