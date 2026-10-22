// Dữ liệu mẫu — thay bằng API khi backend sẵn sàng.
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ProblemStatus = 'solved' | 'attempted' | 'unsolved'

export type Problem = {
  id: string
  code: string
  title: string
  difficulty: Difficulty
  topics: string[]
  acceptanceRate: number
  status: ProblemStatus
}

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
}

export const statusLabels: Record<ProblemStatus, string> = {
  solved: 'Đã giải',
  attempted: 'Đã thử',
  unsolved: 'Chưa giải',
}

export const difficultyOptions = ['Tất cả', 'Dễ', 'Trung bình', 'Khó']
export const statusOptions = ['Tất cả', 'Chưa giải', 'Đã giải', 'Đã thử']
export const topicOptions = [
  'Tất cả chủ đề',
  'Mảng',
  'Chuỗi',
  'Toán học',
  'Sắp xếp',
  'Tìm kiếm',
  'Quy hoạch động',
  'Đồ thị',
]

export const sampleProblems: Problem[] = [
  { id: '1', code: 'UTH001', title: 'Tổng hai số', difficulty: 'easy', topics: ['Toán học'], acceptanceRate: 89.4, status: 'solved' },
  { id: '2', code: 'UTH002', title: 'Đảo ngược chuỗi', difficulty: 'easy', topics: ['Chuỗi'], acceptanceRate: 81.2, status: 'solved' },
  { id: '3', code: 'UTH003', title: 'Phần tử lớn nhất của mảng', difficulty: 'easy', topics: ['Mảng'], acceptanceRate: 76.8, status: 'attempted' },
  { id: '4', code: 'UTH004', title: 'Sắp xếp dãy số tăng dần', difficulty: 'easy', topics: ['Sắp xếp', 'Mảng'], acceptanceRate: 68.5, status: 'unsolved' },
  { id: '5', code: 'UTH005', title: 'Tìm kiếm nhị phân', difficulty: 'medium', topics: ['Tìm kiếm', 'Mảng'], acceptanceRate: 54.3, status: 'attempted' },
  { id: '6', code: 'UTH006', title: 'Số nguyên tố trong đoạn', difficulty: 'medium', topics: ['Toán học'], acceptanceRate: 47.9, status: 'unsolved' },
  { id: '7', code: 'UTH007', title: 'Dãy con tăng dài nhất', difficulty: 'medium', topics: ['Quy hoạch động', 'Mảng'], acceptanceRate: 41.6, status: 'unsolved' },
  { id: '8', code: 'UTH008', title: 'Đường đi ngắn nhất', difficulty: 'hard', topics: ['Đồ thị'], acceptanceRate: 28.7, status: 'unsolved' },
  { id: '9', code: 'UTH009', title: 'Xâu con chung dài nhất', difficulty: 'hard', topics: ['Chuỗi', 'Quy hoạch động'], acceptanceRate: 22.1, status: 'attempted' },
  { id: '10', code: 'UTH010', title: 'Cây khung nhỏ nhất', difficulty: 'hard', topics: ['Đồ thị', 'Sắp xếp'], acceptanceRate: 17.4, status: 'unsolved' },
]

export const sampleTotalProblems = 50
export const samplePageSize = 10
