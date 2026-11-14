import { formatContestDate } from '../../contests/data'
import type { ContestPublicationStatus, ContestTimeStatus } from './types'

export const publicationLabels: Record<ContestPublicationStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
}

export const timeStatusLabels: Record<ContestTimeStatus, string> = {
  UPCOMING: 'Sắp diễn ra',
  ONGOING: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  UNPUBLISHED: 'Chưa áp dụng',
}

export function normalizeContestSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
}

export function formatContestDateSafe(value: string | null | undefined): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Chưa thiết lập'
  return formatContestDate(value)
}

export function formatForDateTimeLocal(value: string): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value)).map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function parseDateTimeLocalTimestamp(value: string): number | null {
  if (!value) return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!parts) return null

  const [, yearText, monthText, dayText, hourText, minuteText] = parts
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null

  const localDate = new Date(0)
  localDate.setUTCFullYear(year, month - 1, day)
  localDate.setUTCHours(hour, minute, 0, 0)
  if (
    localDate.getUTCFullYear() !== year
    || localDate.getUTCMonth() !== month - 1
    || localDate.getUTCDate() !== day
  ) {
    return null
  }

  const timestamp = new Date(`${value}:00+07:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function parseDateTimeLocal(value: string): string {
  if (!value) return ''
  const timestamp = parseDateTimeLocalTimestamp(value)
  if (timestamp === null) throw new RangeError('Ngày giờ không hợp lệ.')
  return new Date(timestamp).toISOString()
}

export function suggestContestCode(title: string): string {
  return normalizeContestSearch(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
