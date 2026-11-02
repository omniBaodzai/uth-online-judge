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

export function parseDateTimeLocal(value: string): string {
  if (!value) return ''
  return new Date(`${value}:00+07:00`).toISOString()
}

export function suggestContestCode(title: string): string {
  return normalizeContestSearch(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
