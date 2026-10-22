import { members, type Member } from '../leaderboard/data'

export type ActivityDay = {
  date: string
  count: number
  level: number
}

export type RatingPoint = {
  label: string
  rating: number
}

export type ProfileArticle = {
  title: string
  excerpt: string
  publishedAt: string
  reads: number
}

export type UserProfile = Member & {
  rank: number
  avatarText: string
  bio: string
  institution: string
  contestsParticipated: number
  contestRank: number
  minRating: number
  maxRating: number
  joinedAt: string
  activityDays: ActivityDay[]
  ratingHistory: RatingPoint[]
  articles: ProfileArticle[]
}

const bios: Record<string, string> = {
  nghiaiz: 'Sau hành trình một năm kiên trì luyện tập, mình đã học được rằng mỗi bài toán khó đều có thể giải quyết bằng những bước nhỏ và sự bền bỉ.',
  'minhkhoa.23': 'Sinh viên yêu thích thuật toán và cấu trúc dữ liệu. Mình thường chia sẻ lại những cách tiếp cận dễ hiểu sau mỗi cuộc thi.',
  'ngocanh.dev': 'Lập trình viên trẻ yêu thích giải bài toán, khám phá những ý tưởng mới và học hỏi từ cộng đồng.',
  'hoangnam_08': 'Mình đang từng bước hoàn thiện kỹ năng giải thuật và mong muốn cùng mọi người tiến bộ mỗi ngày.',
  'giabao.cpp': 'C++ enthusiast. Quan tâm đến tối ưu thuật toán, đồ thị và các cuộc thi lập trình đồng đội.',
}

const institutions: Record<string, string> = {
  'ĐH Giao thông vận tải TP.HCM': 'Ho Chi Minh City University of Transport',
  'Khoa Công nghệ thông tin': 'Faculty of Information Technology',
  'CLB Tin học UTH': 'UTH Computer Science Club',
  'ĐH Công nghệ - ĐHQGHN': 'VNU University of Engineering and Technology',
}

const monthLabels = ['Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10']

function createActivity(handle: string): ActivityDay[] {
  const seed = [...handle].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const today = new Date()

  return Array.from({ length: 364 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (363 - index))
    const wave = (seed * 13 + index * 17 + Math.floor(index / 7) * 19) % 23
    const count = wave < 10 ? 0 : wave < 16 ? (wave % 3) + 1 : (wave % 7) + 2

    return {
      date: date.toISOString().slice(0, 10),
      count,
      level: count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4,
    }
  })
}

function createRatingHistory(member: Member, index: number): RatingPoint[] {
  const initialRating = Math.max(900, member.rating - 520 - index * 9)

  return monthLabels.map((label, monthIndex) => {
    const progress = monthIndex / (monthLabels.length - 1)
    const variation = Math.sin(monthIndex * 1.7 + index) * 42
    const rating = monthIndex === monthLabels.length - 1
      ? member.rating
      : Math.round(initialRating + (member.rating - initialRating) * progress + variation * (1 - progress))
    return { label, rating }
  })
}

export const userProfiles: Record<string, UserProfile> = Object.fromEntries(
  members.map((member, index) => {
    const activityDays = createActivity(member.handle)
    const ratingHistory = createRatingHistory(member, index)
    const historyRatings = ratingHistory.map((point) => point.rating)
    const profile: UserProfile = {
      ...member,
      rank: index + 1,
      avatarText: member.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
      bio: bios[member.handle] ?? 'Đang từng bước chinh phục các bài toán thuật toán và tích cực học hỏi từ cộng đồng UTH Online Judge.',
      institution: institutions[member.organization] ?? member.organization,
      contestsParticipated: Math.max(8, Math.round(member.solved * 0.72)),
      contestRank: index + 1,
      minRating: Math.min(...historyRatings),
      maxRating: Math.max(...historyRatings),
      joinedAt: `Tháng ${((index + 3) % 12) + 1}, 202${index % 5 + 1}`,
      activityDays,
      ratingHistory,
      articles: [
        {
          title: 'Một vài kinh nghiệm luyện tập thuật toán hiệu quả',
          excerpt: 'Ghi chú về cách chia nhỏ mục tiêu, xem lại lời giải và duy trì nhịp luyện tập đều đặn.',
          publishedAt: '18/10/2026',
          reads: 126 + index * 9,
        },
        {
          title: 'Những điều mình học được từ các cuộc thi lập trình',
          excerpt: 'Từ cách đọc đề, quản lý thời gian đến việc phân tích những test case biên.',
          publishedAt: '02/09/2026',
          reads: 84 + index * 7,
        },
      ],
    }

    return [member.handle.toLocaleLowerCase('vi'), profile]
  }),
)

type AccountIdentity = {
  username: string | null
  email: string
  fullName: string | null
  createdAt: string
}

export function createAccountProfile(account: AccountIdentity): UserProfile {
  const handle = account.username ?? account.email.split('@')[0]
  const fullName = account.fullName || handle
  const index = [...handle].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 7 + 2
  const member: Member = {
    handle,
    fullName,
    rating: 1180 + index * 37,
    score: 120 + index * 23.45,
    solved: 12 + index * 3,
    contributions: index * 2,
    organization: 'ĐH Giao thông vận tải TP.HCM',
  }
  const ratingHistory = createRatingHistory(member, index)
  const historyRatings = ratingHistory.map((point) => point.rating)
  const joined = new Date(account.createdAt)

  return {
    ...member,
    rank: 40 + index * 5,
    avatarText: fullName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
    bio: 'Sinh viên UTH đang luyện tập thuật toán mỗi ngày. Hãy chỉnh sửa hồ sơ để cập nhật phần giới thiệu của bạn.',
    institution: institutions[member.organization],
    contestsParticipated: 6 + index,
    contestRank: 60 + index * 4,
    minRating: Math.min(...historyRatings),
    maxRating: Math.max(...historyRatings),
    joinedAt: Number.isNaN(joined.getTime()) ? '—' : `Tháng ${joined.getMonth() + 1}, ${joined.getFullYear()}`,
    activityDays: createActivity(handle),
    ratingHistory,
    articles: [],
  }
}