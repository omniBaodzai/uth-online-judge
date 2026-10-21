export type SubmissionStatus = 'AC' | 'WA' | 'TLE' | 'CE' | 'RE' | 'MLE'

export type Submission = {
  id: string
  problemId: string
  problemTitle: string
  tags: string[]
  status: SubmissionStatus
  passedTests: number
  totalTests: number
  language: string
  username: string
  submittedAt: string
  dateTime: string
  runtimeMs: number | null
  memoryMb: number | null
  organization: string
}

export type SubmissionFilters = {
  status: string
  language: string
  organization: string
}

export const defaultSubmissionFilters: SubmissionFilters = {
  status: 'Tất cả trạng thái',
  language: 'Tất cả ngôn ngữ',
  organization: 'Tất cả tổ chức',
}

export const submissions: Submission[] = [
  { id: 'S-98421', problemId: 'UTH005', problemTitle: 'Tìm kiếm nhị phân', tags: ['Tìm kiếm', 'Mảng'], status: 'AC', passedTests: 23, totalTests: 23, language: 'C++17', username: 'minhkhoa.23', submittedAt: '21/10/2026, 10:42', dateTime: '2026-10-21T10:42:00+07:00', runtimeMs: 16, memoryMb: 2.0, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98420', problemId: 'UTH004', problemTitle: 'Đường đi ngắn nhất', tags: ['Đồ thị', 'BFS'], status: 'TLE', passedTests: 18, totalTests: 23, language: 'Python 3', username: 'ngocanh.dev', submittedAt: '21/10/2026, 10:39', dateTime: '2026-10-21T10:39:00+07:00', runtimeMs: 2000, memoryMb: 14.8, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98419', problemId: 'UTH003', problemTitle: 'Chuỗi đối xứng', tags: ['Chuỗi', 'Hai con trỏ'], status: 'AC', passedTests: 31, totalTests: 31, language: 'C++20', username: 'khoa_uth', submittedAt: '21/10/2026, 10:35', dateTime: '2026-10-21T10:35:00+07:00', runtimeMs: 8, memoryMb: 2.4, organization: 'CLB Tin học UTH' },
  { id: 'S-98418', problemId: 'UTH006', problemTitle: 'Dãy con tăng dài nhất', tags: ['Quy hoạch động'], status: 'WA', passedTests: 12, totalTests: 27, language: 'Java 17', username: 'linhpham', submittedAt: '21/10/2026, 10:31', dateTime: '2026-10-21T10:31:00+07:00', runtimeMs: 145, memoryMb: 18.2, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98417', problemId: 'UTH001', problemTitle: 'Tổng hai số', tags: ['Cơ bản', 'Toán học'], status: 'CE', passedTests: 0, totalTests: 12, language: 'C++17', username: 'tuananh_04', submittedAt: '21/10/2026, 10:27', dateTime: '2026-10-21T10:27:00+07:00', runtimeMs: null, memoryMb: null, organization: 'Khoa Công nghệ thông tin' },
  { id: 'S-98416', problemId: 'UTH007', problemTitle: 'Đếm thành phần liên thông', tags: ['Đồ thị', 'DFS'], status: 'AC', passedTests: 19, totalTests: 19, language: 'C++17', username: 'hoangnam_08', submittedAt: '21/10/2026, 10:20', dateTime: '2026-10-21T10:20:00+07:00', runtimeMs: 24, memoryMb: 3.1, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98415', problemId: 'UTH009', problemTitle: 'Ngoặc hợp lệ', tags: ['Ngăn xếp', 'Chuỗi'], status: 'RE', passedTests: 7, totalTests: 20, language: 'Python 3', username: 'baovy', submittedAt: '21/10/2026, 10:14', dateTime: '2026-10-21T10:14:00+07:00', runtimeMs: 32, memoryMb: 10.6, organization: 'CLB Tin học UTH' },
  { id: 'S-98414', problemId: 'UTH008', problemTitle: 'Ước chung lớn nhất', tags: ['Số học'], status: 'AC', passedTests: 16, totalTests: 16, language: 'C++20', username: 'giabao.cpp', submittedAt: '21/10/2026, 10:09', dateTime: '2026-10-21T10:09:00+07:00', runtimeMs: 4, memoryMb: 1.8, organization: 'Khoa Công nghệ thông tin' },
  { id: 'S-98413', problemId: 'UTH012', problemTitle: 'Cây khung nhỏ nhất', tags: ['Đồ thị', 'MST'], status: 'MLE', passedTests: 14, totalTests: 22, language: 'Java 17', username: 'minhkhoa.23', submittedAt: '21/10/2026, 10:02', dateTime: '2026-10-21T10:02:00+07:00', runtimeMs: 380, memoryMb: 256, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98412', problemId: 'UTH002', problemTitle: 'Dãy số Fibonacci', tags: ['Quy hoạch động'], status: 'AC', passedTests: 20, totalTests: 20, language: 'C++17', username: 'quynhmai', submittedAt: '21/10/2026, 09:56', dateTime: '2026-10-21T09:56:00+07:00', runtimeMs: 11, memoryMb: 2.1, organization: 'CLB Tin học UTH' },
  { id: 'S-98411', problemId: 'UTH011', problemTitle: 'Sắp xếp sự kiện', tags: ['Sắp xếp', 'Tham lam'], status: 'WA', passedTests: 25, totalTests: 30, language: 'C# 12', username: 'namtran', submittedAt: '21/10/2026, 09:52', dateTime: '2026-10-21T09:52:00+07:00', runtimeMs: 72, memoryMb: 9.3, organization: 'ĐH Công nghệ - ĐHQGHN' },
  { id: 'S-98410', problemId: 'UTH016', problemTitle: 'Tổng tiền tố', tags: ['Mảng', 'Cộng dồn'], status: 'AC', passedTests: 25, totalTests: 25, language: 'C++20', username: 'ngocanh.dev', submittedAt: '21/10/2026, 09:48', dateTime: '2026-10-21T09:48:00+07:00', runtimeMs: 6, memoryMb: 2.6, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98409', problemId: 'UTH013', problemTitle: 'Truy vấn tổng đoạn', tags: ['Mảng', 'Cây đoạn'], status: 'TLE', passedTests: 9, totalTests: 18, language: 'Python 3', username: 'linhpham', submittedAt: '21/10/2026, 09:41', dateTime: '2026-10-21T09:41:00+07:00', runtimeMs: 2000, memoryMb: 28.4, organization: 'Khoa Công nghệ thông tin' },
  { id: 'S-98408', problemId: 'UTH018', problemTitle: 'Mô phỏng hàng đợi', tags: ['Hàng đợi', 'Mô phỏng'], status: 'AC', passedTests: 17, totalTests: 17, language: 'Go 1.23', username: 'khoa_uth', submittedAt: '21/10/2026, 09:37', dateTime: '2026-10-21T09:37:00+07:00', runtimeMs: 21, memoryMb: 3.7, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98407', problemId: 'UTH010', problemTitle: 'Đồng xu đổi tiền', tags: ['Tham lam', 'Quy hoạch động'], status: 'WA', passedTests: 11, totalTests: 24, language: 'Java 17', username: 'tuananh_04', submittedAt: '21/10/2026, 09:31', dateTime: '2026-10-21T09:31:00+07:00', runtimeMs: 99, memoryMb: 15.5, organization: 'CLB Tin học UTH' },
  { id: 'S-98406', problemId: 'UTH005', problemTitle: 'Tìm kiếm nhị phân', tags: ['Tìm kiếm', 'Mảng'], status: 'AC', passedTests: 23, totalTests: 23, language: 'Rust 1.82', username: 'hoangnam_08', submittedAt: '21/10/2026, 09:24', dateTime: '2026-10-21T09:24:00+07:00', runtimeMs: 5, memoryMb: 2.3, organization: 'ĐH Công nghệ - ĐHQGHN' },
  { id: 'S-98405', problemId: 'UTH014', problemTitle: 'Hoán vị kế tiếp', tags: ['Tổ hợp', 'Sắp xếp'], status: 'AC', passedTests: 22, totalTests: 22, language: 'C++17', username: 'giabao.cpp', submittedAt: '21/10/2026, 09:18', dateTime: '2026-10-21T09:18:00+07:00', runtimeMs: 13, memoryMb: 2.9, organization: 'Khoa Công nghệ thông tin' },
  { id: 'S-98404', problemId: 'UTH015', problemTitle: 'Tô màu bản đồ', tags: ['Đồ thị', 'DFS'], status: 'WA', passedTests: 16, totalTests: 28, language: 'C++20', username: 'baovy', submittedAt: '21/10/2026, 09:12', dateTime: '2026-10-21T09:12:00+07:00', runtimeMs: 201, memoryMb: 4.8, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98403', problemId: 'UTH001', problemTitle: 'Tổng hai số', tags: ['Cơ bản', 'Toán học'], status: 'AC', passedTests: 12, totalTests: 12, language: 'C++17', username: 'nghiaiz', submittedAt: '21/10/2026, 09:06', dateTime: '2026-10-21T09:06:00+07:00', runtimeMs: 3, memoryMb: 1.6, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98402', problemId: 'UTH004', problemTitle: 'Đường đi ngắn nhất', tags: ['Đồ thị', 'BFS'], status: 'AC', passedTests: 23, totalTests: 23, language: 'C++20', username: 'huynguyen', submittedAt: '21/10/2026, 09:01', dateTime: '2026-10-21T09:01:00+07:00', runtimeMs: 19, memoryMb: 3.0, organization: 'ĐH Công nghệ - ĐHQGHN' },
  { id: 'S-98401', problemId: 'UTH016', problemTitle: 'Tổng tiền tố', tags: ['Mảng', 'Cộng dồn'], status: 'AC', passedTests: 25, totalTests: 25, language: 'Python 3', username: 'thanhdat', submittedAt: '21/10/2026, 08:58', dateTime: '2026-10-21T08:58:00+07:00', runtimeMs: 28, memoryMb: 11.2, organization: 'Khoa Công nghệ thông tin' },
  { id: 'S-98400', problemId: 'UTH009', problemTitle: 'Ngoặc hợp lệ', tags: ['Ngăn xếp', 'Chuỗi'], status: 'WA', passedTests: 14, totalTests: 20, language: 'Java 17', username: 'thaochi', submittedAt: '21/10/2026, 08:53', dateTime: '2026-10-21T08:53:00+07:00', runtimeMs: 42, memoryMb: 13.4, organization: 'CLB Tin học UTH' },
  { id: 'S-98399', problemId: 'UTH007', problemTitle: 'Đếm thành phần liên thông', tags: ['Đồ thị', 'DFS'], status: 'AC', passedTests: 19, totalTests: 19, language: 'C++17', username: 'ducanh_cpp', submittedAt: '21/10/2026, 08:47', dateTime: '2026-10-21T08:47:00+07:00', runtimeMs: 17, memoryMb: 2.8, organization: 'ĐH Giao thông vận tải TP.HCM' },
  { id: 'S-98398', problemId: 'UTH002', problemTitle: 'Dãy số Fibonacci', tags: ['Quy hoạch động'], status: 'AC', passedTests: 20, totalTests: 20, language: 'Python 3', username: 'phuonglinh', submittedAt: '21/10/2026, 08:41', dateTime: '2026-10-21T08:41:00+07:00', runtimeMs: 36, memoryMb: 12.1, organization: 'ĐH Công nghệ - ĐHQGHN' },
]

export const submissionPageSize = 8
export const globalSubmissionTotal = 2_484_781

export const submissionStatuses: SubmissionStatus[] = ['AC', 'WA', 'TLE', 'CE', 'RE', 'MLE']
export const submissionLanguages = [...new Set(submissions.map((submission) => submission.language))].sort()
export const submissionOrganizations = [...new Set(submissions.map((submission) => submission.organization))].sort()

export const statusDescriptions: Record<SubmissionStatus, string> = {
  AC: 'Chấp nhận',
  WA: 'Sai kết quả',
  TLE: 'Quá thời gian',
  CE: 'Lỗi biên dịch',
  RE: 'Lỗi thực thi',
  MLE: 'Quá bộ nhớ',
}