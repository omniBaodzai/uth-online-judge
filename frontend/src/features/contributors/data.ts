import { topContributors } from '../home/data'

export interface Contributor {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  points: number
  contributedProblems: number
}

export interface ContributorsPageResult {
  items: Array<Contributor & { rank: number }>
  total: number
}

const POINTS_PER_PROBLEM = 10

const extraContributors: Array<Pick<Contributor, 'username' | 'displayName' | 'contributedProblems'>> = [
  { username: 'hoangnam', displayName: 'Lê Hoàng Nam', contributedProblems: 11 },
  { username: 'thuha.uth', displayName: 'Nguyễn Thu Hà', contributedProblems: 10 },
  { username: 'ducminh', displayName: 'Phan Đức Minh', contributedProblems: 9 },
  { username: 'baotran', displayName: 'Trần Quốc Bảo', contributedProblems: 9 },
  { username: 'khanhly', displayName: 'Hoàng Khánh Ly', contributedProblems: 8 },
  { username: 'tuananh.cp', displayName: 'Vũ Tuấn Anh', contributedProblems: 8 },
  { username: 'minhthu', displayName: 'Bùi Minh Thư', contributedProblems: 7 },
  { username: 'quanghuy', displayName: 'Đặng Quang Huy', contributedProblems: 7 },
  { username: 'thanhtam', displayName: 'Lý Thanh Tâm', contributedProblems: 6 },
  { username: 'ngockhanh', displayName: 'Ngô Ngọc Khánh', contributedProblems: 6 },
  { username: 'huuphuc', displayName: 'Dương Hữu Phúc', contributedProblems: 5 },
  { username: 'baongoc', displayName: 'Mai Bảo Ngọc', contributedProblems: 5 },
  { username: 'trungkien', displayName: 'Hồ Trung Kiên', contributedProblems: 4 },
  { username: 'anhthu', displayName: 'Đinh Anh Thư', contributedProblems: 4 },
  { username: 'minhquan', displayName: 'Trịnh Minh Quân', contributedProblems: 3 },
  { username: 'phuongnam', displayName: 'Lâm Phương Nam', contributedProblems: 3 },
  { username: 'thaonguyen', displayName: 'Cao Thảo Nguyên', contributedProblems: 2 },
  { username: 'tienduc', displayName: 'Tạ Tiến Đức', contributedProblems: 2 },
  { username: 'ngocmai', displayName: 'Châu Ngọc Mai', contributedProblems: 1 },
]

// Mock data: replace with an API call returning the same shape when the backend is ready.
export const mockContributors: Contributor[] = [
  ...topContributors.map((person) => ({
    username: person.handle,
    displayName: person.name,
    contributedProblems: person.score,
  })),
  ...extraContributors,
].map((item) => ({
  id: item.username,
  username: item.username,
  displayName: item.displayName,
  avatarUrl: null,
  points: item.contributedProblems * POINTS_PER_PROBLEM,
  contributedProblems: item.contributedProblems,
}))

export function getContributorsPage({
  page,
  pageSize,
  q,
}: {
  page: number
  pageSize: number
  q: string
}): ContributorsPageResult {
  const keyword = q.trim().toLowerCase()
  const ranked = mockContributors.map((item, index) => ({ ...item, rank: index + 1 }))
  const filtered = keyword ? ranked.filter((item) => item.username.toLowerCase().includes(keyword)) : ranked
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), total: filtered.length }
}
