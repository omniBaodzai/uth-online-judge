export type ContestStatus = 'ongoing' | 'upcoming' | 'past'

export type Contest = {
  id: string
  title: string
  startTime: string
  endTime: string
  durationMinutes: number
  participantCount: number
  virtualParticipantCount: number
  status: ContestStatus
}

const contestTitles = [
  'UTH Weekly Challenge',
  'Lập trình cơ bản — Vòng 1',
  'Thuật toán và cấu trúc dữ liệu',
  'Thử thách lập trình sinh viên',
  'Code Sprint mùa thu',
  'Olympic Tin học UTH',
  'Dynamic Programming Practice',
  'Kỳ thi lập trình tháng',
  'Graph Theory Challenge',
  'Nhập môn lập trình — Kiểm tra cuối kỳ',
  'UTH Algorithm Contest',
  'Competitive Programming Warm-up',
  'String Processing Challenge',
  'Lập trình hướng đối tượng',
  'Data Structures Open',
  'Coding Night tại UTH',
  'Toán rời rạc và lập trình',
  'Junior Programmer Cup',
  'UTH ICPC Selection',
  'Programming Fundamentals Cup',
  'Advanced Algorithms Round',
  'Giải thuật tham lam',
  'Summer Code Challenge',
  'University Programming League',
]

const DAY_MS = 24 * 60 * 60 * 1000
const durations = [90, 120, 180]

function createContestBatch(
  status: ContestStatus,
  startDate: string,
  dayOffset: number,
  participantBase: number,
): Contest[] {
  const firstStart = new Date(startDate).getTime()
  return contestTitles.map((title, index) => {
    const startTime = new Date(firstStart + index * dayOffset * DAY_MS)
    const durationMinutes = durations[index % durations.length]
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    return {
      id: `${status}-${index + 1}`,
      title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes,
      participantCount: participantBase + index * 3,
      virtualParticipantCount: status === 'past' ? participantBase + 30 + index * 4 : 0,
      status,
    }
  })
}

export const ongoingContests = createContestBatch(
  'ongoing',
  '2026-10-30T20:30:00+07:00',
  0,
  128,
)

export const upcomingContests = createContestBatch(
  'upcoming',
  '2026-11-01T09:00:00+07:00',
  1,
  75,
)

export const pastContests = createContestBatch(
  'past',
  '2026-10-29T09:00:00+07:00',
  -1,
  70,
)

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

export function searchContests(contests: Contest[], query: string): Contest[] {
  const normalizedQuery = normalizeSearchText(query.trim())
  if (!normalizedQuery) return contests

  return contests.filter((contest) => normalizeSearchText(contest.title).includes(normalizedQuery))
}

export function paginateContests(contests: Contest[], page: number, pageSize: number): Contest[] {
  const start = (page - 1) * pageSize
  return contests.slice(start, start + pageSize)
}

const contestDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function formatContestDate(value: string): string {
  const parts = Object.fromEntries(
    contestDateFormatter.formatToParts(new Date(value)).map(({ type, value: partValue }) => [type, partValue]),
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}
