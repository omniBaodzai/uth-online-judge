export type LeaderboardCategory = 'ranking' | 'contributions' | 'organizations'

export type Member = {
  handle: string
  fullName: string
  rating: number
  score: number
  solved: number
  contributions: number
  organization: string
}

export type Organization = {
  name: string
  shortName: string
  members: number
  score: number
  solved: number
}

export const members: Member[] = [
  { handle: 'nghiaiz', fullName: 'Nguyen Duy Nghia', rating: 2851, score: 58.92, solved: 92, contributions: 12, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'minhkhoa.23', fullName: 'Nguyen Minh Khoa', rating: 2652, score: 57.48, solved: 95, contributions: 9, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'ngocanh.dev', fullName: 'Tran Ngoc Anh', rating: 2543, score: 56.83, solved: 89, contributions: 15, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'hoangnam_08', fullName: 'Le Hoang Nam', rating: 2476, score: 54.21, solved: 86, contributions: 6, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'giabao.cpp', fullName: 'Pham Gia Bao', rating: 2398, score: 52.76, solved: 81, contributions: 11, organization: 'Khoa Công nghệ thông tin' },
  { handle: 'linhpham', fullName: 'Vo Thuy Linh', rating: 2314, score: 51.32, solved: 78, contributions: 8, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'quynhmai', fullName: 'Do Quynh Mai', rating: 2247, score: 49.85, solved: 74, contributions: 13, organization: 'CLB Tin học UTH' },
  { handle: 'tuananh_04', fullName: 'Nguyen Tuan Anh', rating: 2186, score: 47.93, solved: 71, contributions: 5, organization: 'Khoa Công nghệ thông tin' },
  { handle: 'baovy', fullName: 'Pham Bao Vy', rating: 2112, score: 46.71, solved: 67, contributions: 7, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'khoa_uth', fullName: 'Tran Dang Khoa', rating: 2054, score: 44.38, solved: 63, contributions: 10, organization: 'CLB Tin học UTH' },
  { handle: 'namtran', fullName: 'Tran Hoang Nam', rating: 1981, score: 42.16, solved: 59, contributions: 4, organization: 'ĐH Công nghệ - ĐHQGHN' },
  { handle: 'huynguyen', fullName: 'Nguyen Quang Huy', rating: 1905, score: 40.92, solved: 55, contributions: 3, organization: 'ĐH Công nghệ - ĐHQGHN' },
  { handle: 'thanhdat', fullName: 'Le Thanh Dat', rating: 1837, score: 38.74, solved: 51, contributions: 6, organization: 'Khoa Công nghệ thông tin' },
  { handle: 'thaochi', fullName: 'Nguyen Thao Chi', rating: 1772, score: 36.53, solved: 47, contributions: 8, organization: 'CLB Tin học UTH' },
  { handle: 'ducanh_cpp', fullName: 'Bui Duc Anh', rating: 1698, score: 34.17, solved: 43, contributions: 2, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { handle: 'phuonglinh', fullName: 'Tran Phuong Linh', rating: 1613, score: 31.86, solved: 38, contributions: 5, organization: 'ĐH Công nghệ - ĐHQGHN' },
]

export const organizations: Organization[] = [
  { name: 'Đại học Giao thông vận tải TP.HCM', shortName: 'UTH', members: 1248, score: 86.42, solved: 18264 },
  { name: 'Khoa Công nghệ thông tin', shortName: 'FIT', members: 684, score: 79.18, solved: 10231 },
  { name: 'Câu lạc bộ Tin học UTH', shortName: 'UTH-IT', members: 392, score: 74.63, solved: 6812 },
  { name: 'Đại học Công nghệ - ĐHQGHN', shortName: 'UET', members: 936, score: 82.74, solved: 14385 },
  { name: 'Đại học Bách khoa TP.HCM', shortName: 'HCMUT', members: 817, score: 80.29, solved: 12947 },
  { name: 'Đại học Cần Thơ', shortName: 'CTU', members: 523, score: 68.45, solved: 7351 },
]

export const leaderboardPageSize = 8