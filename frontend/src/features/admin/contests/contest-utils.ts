import { formatContestDate } from '../../contests/data'
import type { Contest, ContestPublicationStatus } from './types'

export type ContestTimeStatus = 'upcoming' | 'ongoing' | 'ended' | 'unscheduled'

export const publicationLabels: Record<ContestPublicationStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
}

export const timeStatusLabels: Record<ContestTimeStatus, string> = {
  upcoming: 'Sắp diễn ra',
  ongoing: 'Đang diễn ra',
  ended: 'Đã kết thúc',
  unscheduled: 'Chưa thiết lập',
}

export function getContestTimeStatus(contest: Pick<Contest, 'startTime' | 'endTime'>, now: number): ContestTimeStatus {
  const start = new Date(contest.startTime).getTime()
  const end = new Date(contest.endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'unscheduled'
  if (now < start) return 'upcoming'
  if (now >= end) return 'ended'
  return 'ongoing'
}

export function normalizeContestSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
}

export function formatContestDateSafe(value: string): string {
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
