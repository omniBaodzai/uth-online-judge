export type ContestStatus = 'ongoing' | 'upcoming' | 'past'

export type ContestProblem = {
  id: string
  code: string
  title: string
  maxScore: number
  isLocked: boolean
}

export type Contest = {
  id: string
  title: string
  startTime: string
  endTime: string
  durationMinutes: number
  participantCount: number
  virtualParticipantCount: number
  status: ContestStatus
  problems: ContestProblem[]
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
const problemTitles = [
  'Tổng hai số nguyên',
  'Dãy số Fibonacci',
  'Ước chung lớn nhất',
  'Sắp xếp danh sách',
  'Đường đi ngắn nhất',
  'Chuỗi đối xứng',
  'Tổng các chữ số',
  'Tìm kiếm nhị phân',
  'Đếm số nguyên tố',
  'Balo tối ưu',
  'Cây khung nhỏ nhất',
  'Phần tử xuất hiện nhiều nhất',
  'Quy hoạch động trên lưới',
  'Ghép cặp tối ưu',
  'Đường đi Euler',
]
const problemScores = [100, 100, 100, 200, 200, 100, 100, 200, 200, 300, 300, 200, 300, 300, 300]

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
      problems: problemTitles.map((problemTitle, problemIndex) => ({
        id: `${status}-${index + 1}-problem-${problemIndex + 1}`,
        code: `${String.fromCharCode(65 + problemIndex)}${index + 1}`,
        title: problemTitle,
        maxScore: problemScores[problemIndex],
        isLocked: (problemIndex + index) % 3 === 0,
      })),
    }
  })
}

const now = Date.now()

export const ongoingContests = createContestBatch(
  'ongoing',
  new Date(now - 30 * 60 * 1000).toISOString(),
  0,
  128,
)

export const upcomingContests = createContestBatch(
  'upcoming',
  new Date(now + DAY_MS).toISOString(),
  1,
  75,
)

export const pastContests = createContestBatch(
  'past',
  new Date(now - DAY_MS).toISOString(),
  -1,
  70,
)

export const allContests = [...ongoingContests, ...upcomingContests, ...pastContests]

export function getContestById(contestId: string): Contest | undefined {
  return allContests.find((contest) => contest.id === contestId)
}

export function getContestActionLabel(status: ContestStatus): string {
  if (status === 'upcoming') return 'Đăng ký'
  if (status === 'past') return 'Tham gia ảo'
  return 'Tham gia'
}

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

export function paginateContests<T>(contests: T[], page: number, pageSize: number): T[] {
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

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function getCountdownParts(targetTime: string, nowTime: number): CountdownParts {
  const targetTimestamp = new Date(targetTime).getTime()
  const remainingSeconds = Number.isFinite(targetTimestamp)
    ? Math.max(0, Math.floor((targetTimestamp - nowTime) / 1000))
    : 0

  return {
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
  }
}
