export type ContestProblemRow = {
  code: string
  title: string
  points: number
  problemId: string
}

export type ContestComment = {
  user: string
  time: string
  message: string
}

export type ContestDetailData = {
  rules: string[]
  problems: ContestProblemRow[]
  comments: ContestComment[]
}

const defaultRules = [
  'Không trao đổi lời giải hoặc mã nguồn với thí sinh khác trong thời gian làm bài.',
  'Chỉ sử dụng các ngôn ngữ được hỗ trợ trên hệ thống và không thực hiện hành vi gây ảnh hưởng đến máy chấm.',
  'Bài nộp được chấm tự động; kết quả cuối cùng căn cứ theo dữ liệu từ hệ thống chấm.',
]

const standardComments: ContestComment[] = [
  { user: 'minhkhoa.23', time: '21/10/2026, 10:15', message: 'Mình đang luyện lại contest này, bài đồ thị có test khá thú vị.' },
  { user: 'ngocanh.dev', time: '20/10/2026, 18:42', message: 'Cảm ơn ban tổ chức, bộ đề phân bổ độ khó rất hợp lý.' },
]

const problemSets: Record<string, ContestProblemRow[]> = {
  'uth-round-12': [
    { code: 'A', title: 'Tổng hai số', points: 500, problemId: 'UTH001' },
    { code: 'B', title: 'Dãy số đặc biệt', points: 750, problemId: 'UTH002' },
    { code: 'C', title: 'Chuỗi đối xứng', points: 1000, problemId: 'UTH003' },
    { code: 'D', title: 'Đường đi ngắn nhất', points: 1500, problemId: 'UTH004' },
    { code: 'E', title: 'Truy vấn tổng đoạn', points: 2000, problemId: 'UTH013' },
  ],
  'freshman-cup-2026': [
    { code: 'A', title: 'Tổng hai số', points: 500, problemId: 'UTH001' },
    { code: 'B', title: 'Ước chung lớn nhất', points: 750, problemId: 'UTH008' },
    { code: 'C', title: 'Tìm kiếm nhị phân', points: 1000, problemId: 'UTH005' },
    { code: 'D', title: 'Ngoặc hợp lệ', points: 1250, problemId: 'UTH009' },
  ],
  'algorithm-week-3': [
    { code: 'A', title: 'Tổng tiền tố', points: 500, problemId: 'UTH016' },
    { code: 'B', title: 'Sắp xếp sự kiện', points: 1000, problemId: 'UTH011' },
    { code: 'C', title: 'Đồng xu đổi tiền', points: 1500, problemId: 'UTH010' },
  ],
  'uth-round-11': [
    { code: 'A', title: 'Ước chung lớn nhất', points: 500, problemId: 'UTH008' },
    { code: 'B', title: 'Hoán vị kế tiếp', points: 1000, problemId: 'UTH014' },
    { code: 'C', title: 'Đếm thành phần liên thông', points: 1250, problemId: 'UTH007' },
    { code: 'D', title: 'Cây khung nhỏ nhất', points: 2000, problemId: 'UTH012' },
  ],
  'data-structures-open': [
    { code: 'A', title: 'Mô phỏng hàng đợi', points: 500, problemId: 'UTH018' },
    { code: 'B', title: 'Ngoặc hợp lệ', points: 750, problemId: 'UTH009' },
    { code: 'C', title: 'Tổng tiền tố', points: 1000, problemId: 'UTH016' },
    { code: 'D', title: 'Truy vấn tổng đoạn', points: 1750, problemId: 'UTH013' },
  ],
  'uth-team-selection': [
    { code: 'A', title: 'Dãy con tăng dài nhất', points: 1000, problemId: 'UTH006' },
    { code: 'B', title: 'Cây khung nhỏ nhất', points: 1500, problemId: 'UTH012' },
    { code: 'C', title: 'Tô màu bản đồ', points: 2000, problemId: 'UTH015' },
  ],
  'summer-algorithm-series': [
    { code: 'A', title: 'Dãy số Fibonacci', points: 500, problemId: 'UTH002' },
    { code: 'B', title: 'Đồng xu đổi tiền', points: 1000, problemId: 'UTH010' },
    { code: 'C', title: 'Xâu con chung dài nhất', points: 1750, problemId: 'UTH017' },
  ],
  'graph-challenge': [
    { code: 'A', title: 'Đếm thành phần liên thông', points: 750, problemId: 'UTH007' },
    { code: 'B', title: 'Đường đi ngắn nhất', points: 1250, problemId: 'UTH004' },
    { code: 'C', title: 'Cây khung nhỏ nhất', points: 1750, problemId: 'UTH012' },
    { code: 'D', title: 'Tô màu bản đồ', points: 2000, problemId: 'UTH015' },
  ],
  'uth-round-10': [
    { code: 'A', title: 'Chuỗi đối xứng', points: 500, problemId: 'UTH003' },
    { code: 'B', title: 'Tìm kiếm nhị phân', points: 750, problemId: 'UTH005' },
    { code: 'C', title: 'Dãy con tăng dài nhất', points: 1250, problemId: 'UTH006' },
    { code: 'D', title: 'Hoán vị kế tiếp', points: 1500, problemId: 'UTH014' },
  ],
  'intra-uth-sprint': [
    { code: 'A', title: 'Tổng hai số', points: 500, problemId: 'UTH001' },
    { code: 'B', title: 'Mô phỏng hàng đợi', points: 750, problemId: 'UTH018' },
    { code: 'C', title: 'Tổng tiền tố', points: 1000, problemId: 'UTH016' },
  ],
  'dynamic-programming-cup': [
    { code: 'A', title: 'Dãy số Fibonacci', points: 500, problemId: 'UTH002' },
    { code: 'B', title: 'Đồng xu đổi tiền', points: 1000, problemId: 'UTH010' },
    { code: 'C', title: 'Dãy con tăng dài nhất', points: 1500, problemId: 'UTH006' },
    { code: 'D', title: 'Xâu con chung dài nhất', points: 2000, problemId: 'UTH017' },
  ],
  'uth-round-9': [
    { code: 'A', title: 'Ước chung lớn nhất', points: 500, problemId: 'UTH008' },
    { code: 'B', title: 'Sắp xếp sự kiện', points: 750, problemId: 'UTH011' },
    { code: 'C', title: 'Truy vấn tổng đoạn', points: 1250, problemId: 'UTH013' },
    { code: 'D', title: 'Tô màu bản đồ', points: 1750, problemId: 'UTH015' },
  ],
}

export const contestDetails: Record<string, ContestDetailData> = Object.fromEntries(
  Object.entries(problemSets).map(([id, contestProblems]) => [id, {
    rules: defaultRules,
    problems: contestProblems,
    comments: standardComments,
  }]),
)

export const contestStandings = [
  { rank: 1, username: 'nghiaiz', solved: 5, penalty: '02:14:36', score: 4750 },
  { rank: 2, username: 'minhkhoa.23', solved: 5, penalty: '02:31:08', score: 4500 },
  { rank: 3, username: 'ngocanh.dev', solved: 4, penalty: '01:48:52', score: 3750 },
  { rank: 4, username: 'hoangnam_08', solved: 4, penalty: '02:02:41', score: 3500 },
  { rank: 5, username: 'giabao.cpp', solved: 3, penalty: '01:35:20', score: 2750 },
]

export const contestSubmissions = [
  { username: 'nghiaiz', problem: 'A. Tổng hai số', result: 'AC', language: 'C++17', time: '09:42:18' },
  { username: 'minhkhoa.23', problem: 'D. Đường đi ngắn nhất', result: 'AC', language: 'C++20', time: '09:39:51' },
  { username: 'ngocanh.dev', problem: 'C. Chuỗi đối xứng', result: 'WA', language: 'Python 3', time: '09:37:04' },
  { username: 'hoangnam_08', problem: 'B. Dãy số đặc biệt', result: 'AC', language: 'C++17', time: '09:33:29' },
  { username: 'giabao.cpp', problem: 'A. Tổng hai số', result: 'AC', language: 'C++17', time: '09:30:11' },
]