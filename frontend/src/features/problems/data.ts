export type ProblemDifficulty = 'Dễ' | 'Trung bình' | 'Khó'
export type ProblemStatus = 'solved' | 'attempted' | 'unsolved'

export type Problem = {
  id: string
  title: string
  tags: string[]
  topic: string
  score: number
  acceptance: number
  acceptedCount: number
  difficulty: ProblemDifficulty
  status: ProblemStatus
  hasEditorial: boolean
}

export type ProblemFilters = {
  keyword: string
  topic: string
  difficulty: string
  minScore: number
  maxScore: number
  solvedOnly: boolean
  editorialOnly: boolean
}

export const defaultProblemFilters: ProblemFilters = {
  keyword: '',
  topic: 'Tất cả nhóm',
  difficulty: 'Tất cả mức độ',
  minScore: 0,
  maxScore: 100,
  solvedOnly: false,
  editorialOnly: false,
}

export const problems: Problem[] = [
  { id: 'UTH001', title: 'Tổng hai số', tags: ['Cơ bản', 'Toán học'], topic: 'Nhập môn', score: 10, acceptance: 82.4, acceptedCount: 1248, difficulty: 'Dễ', status: 'solved', hasEditorial: true },
  { id: 'UTH002', title: 'Dãy số Fibonacci', tags: ['Quy hoạch động'], topic: 'Quy hoạch động', score: 15, acceptance: 68.7, acceptedCount: 936, difficulty: 'Dễ', status: 'unsolved', hasEditorial: true },
  { id: 'UTH003', title: 'Chuỗi đối xứng', tags: ['Chuỗi', 'Hai con trỏ'], topic: 'Chuỗi', score: 20, acceptance: 54.2, acceptedCount: 714, difficulty: 'Trung bình', status: 'attempted', hasEditorial: false },
  { id: 'UTH004', title: 'Đường đi ngắn nhất', tags: ['Đồ thị', 'BFS'], topic: 'Đồ thị', score: 25, acceptance: 47.9, acceptedCount: 581, difficulty: 'Trung bình', status: 'unsolved', hasEditorial: true },
  { id: 'UTH005', title: 'Tìm kiếm nhị phân', tags: ['Tìm kiếm', 'Mảng'], topic: 'Mảng', score: 15, acceptance: 73.1, acceptedCount: 1002, difficulty: 'Dễ', status: 'solved', hasEditorial: true },
  { id: 'UTH006', title: 'Dãy con tăng dài nhất', tags: ['Quy hoạch động', 'Mảng'], topic: 'Quy hoạch động', score: 30, acceptance: 38.6, acceptedCount: 402, difficulty: 'Khó', status: 'unsolved', hasEditorial: false },
  { id: 'UTH007', title: 'Đếm số thành phần liên thông', tags: ['Đồ thị', 'DFS'], topic: 'Đồ thị', score: 20, acceptance: 61.3, acceptedCount: 773, difficulty: 'Trung bình', status: 'solved', hasEditorial: true },
  { id: 'UTH008', title: 'Ước chung lớn nhất', tags: ['Số học'], topic: 'Nhập môn', score: 10, acceptance: 88.5, acceptedCount: 1456, difficulty: 'Dễ', status: 'unsolved', hasEditorial: true },
  { id: 'UTH009', title: 'Ngoặc hợp lệ', tags: ['Ngăn xếp', 'Chuỗi'], topic: 'Cấu trúc dữ liệu', score: 20, acceptance: 59.8, acceptedCount: 689, difficulty: 'Trung bình', status: 'attempted', hasEditorial: false },
  { id: 'UTH010', title: 'Đồng xu đổi tiền', tags: ['Tham lam', 'Quy hoạch động'], topic: 'Quy hoạch động', score: 25, acceptance: 44.7, acceptedCount: 527, difficulty: 'Trung bình', status: 'unsolved', hasEditorial: true },
  { id: 'UTH011', title: 'Sắp xếp sự kiện', tags: ['Sắp xếp', 'Tham lam'], topic: 'Mảng', score: 20, acceptance: 52.1, acceptedCount: 603, difficulty: 'Trung bình', status: 'solved', hasEditorial: false },
  { id: 'UTH012', title: 'Cây khung nhỏ nhất', tags: ['Đồ thị', 'MST'], topic: 'Đồ thị', score: 35, acceptance: 29.4, acceptedCount: 288, difficulty: 'Khó', status: 'unsolved', hasEditorial: true },
  { id: 'UTH013', title: 'Truy vấn tổng đoạn', tags: ['Mảng', 'Cây đoạn'], topic: 'Cấu trúc dữ liệu', score: 30, acceptance: 34.8, acceptedCount: 351, difficulty: 'Khó', status: 'unsolved', hasEditorial: false },
  { id: 'UTH014', title: 'Hoán vị kế tiếp', tags: ['Tổ hợp', 'Sắp xếp'], topic: 'Toán tổ hợp', score: 25, acceptance: 42.5, acceptedCount: 468, difficulty: 'Trung bình', status: 'attempted', hasEditorial: true },
  { id: 'UTH015', title: 'Tô màu bản đồ', tags: ['Đồ thị', 'DFS'], topic: 'Đồ thị', score: 40, acceptance: 21.6, acceptedCount: 194, difficulty: 'Khó', status: 'unsolved', hasEditorial: true },
  { id: 'UTH016', title: 'Tổng tiền tố', tags: ['Mảng', 'Cộng dồn'], topic: 'Mảng', score: 15, acceptance: 76.2, acceptedCount: 1084, difficulty: 'Dễ', status: 'solved', hasEditorial: true },
  { id: 'UTH017', title: 'Xâu con chung dài nhất', tags: ['Chuỗi', 'Quy hoạch động'], topic: 'Chuỗi', score: 35, acceptance: 31.8, acceptedCount: 302, difficulty: 'Khó', status: 'unsolved', hasEditorial: false },
  { id: 'UTH018', title: 'Mô phỏng hàng đợi', tags: ['Hàng đợi', 'Mô phỏng'], topic: 'Cấu trúc dữ liệu', score: 20, acceptance: 64.1, acceptedCount: 801, difficulty: 'Dễ', status: 'solved', hasEditorial: true },
]

export const featuredProblemIds = ['UTH004', 'UTH006', 'UTH009']

export const problemTopics = [...new Set(problems.map((problem) => problem.topic))].sort()

export const problemPageSize = 8