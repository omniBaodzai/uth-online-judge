// Dữ liệu mẫu — thay bằng API khi backend sẵn sàng.
export type ProblemStatus = 'solved' | 'unsolved' | 'wrong'

export type Problem = {
  id: string
  code: string
  title: string
  points: number
  acceptanceRate: number
  acCount: number
  status: ProblemStatus
  hasSolution: boolean
}

export const statusLabels: Record<ProblemStatus, string> = {
  solved: 'Đã làm',
  unsolved: 'Chưa làm',
  wrong: 'Chưa đúng',
}

export const statusOptions: ProblemStatus[] = ['solved', 'unsolved', 'wrong']

// Dữ liệu mẫu chỉ còn được dùng bởi trang Bài nộp (chưa tích hợp API danh sách bài nộp).

export const sampleProblems: Problem[] = [
  { id: '1', code: 'UTH001', title: 'Tổng hai số', points: 100, acceptanceRate: 89.4, acCount: 1284, status: 'solved', hasSolution: true },
  { id: '2', code: 'UTH002', title: 'Đảo ngược chuỗi', points: 100, acceptanceRate: 81.2, acCount: 1092, status: 'solved', hasSolution: true },
  { id: '3', code: 'UTH003', title: 'Phần tử lớn nhất của mảng', points: 100, acceptanceRate: 76.8, acCount: 947, status: 'wrong', hasSolution: true },
  { id: '4', code: 'UTH004', title: 'Sắp xếp dãy số tăng dần', points: 150, acceptanceRate: 68.5, acCount: 803, status: 'unsolved', hasSolution: true },
  { id: '5', code: 'UTH005', title: 'Tìm kiếm nhị phân', points: 200, acceptanceRate: 54.3, acCount: 612, status: 'wrong', hasSolution: true },
  { id: '6', code: 'UTH006', title: 'Số nguyên tố trong đoạn', points: 200, acceptanceRate: 47.9, acCount: 455, status: 'unsolved', hasSolution: false },
  { id: '7', code: 'UTH007', title: 'Dãy con tăng dài nhất', points: 300, acceptanceRate: 41.6, acCount: 318, status: 'unsolved', hasSolution: true },
  { id: '8', code: 'UTH008', title: 'Đường đi ngắn nhất', points: 400, acceptanceRate: 28.7, acCount: 176, status: 'unsolved', hasSolution: false },
  { id: '9', code: 'UTH009', title: 'Xâu con chung dài nhất', points: 400, acceptanceRate: 22.1, acCount: 134, status: 'wrong', hasSolution: true },
  { id: '10', code: 'UTH010', title: 'Cây khung nhỏ nhất', points: 500, acceptanceRate: 17.4, acCount: 82, status: 'unsolved', hasSolution: false },
]
