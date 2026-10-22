export type OrganizationMember = {
  username: string
  fullName: string
  score: number
  solved: number
  role: 'Quản trị viên' | 'Thành viên'
}

export type OrganizationContest = {
  id: string
  title: string
  startsAt: string
  duration: string
  participants: number
  status: 'Sắp diễn ra' | 'Đang diễn ra' | 'Đã kết thúc'
}

export type OrganizationSubmission = {
  id: string
  problemId: string
  username: string
  status: 'AC' | 'WA' | 'TLE' | 'CE' | 'RE'
  language: string
  runtimeMs: number
  submittedAt: string
}

export type Organization = {
  id: string
  name: string
  fullName: string
  description: string
  score: number
  memberCount: number
  joined: boolean
  problemIds: string[]
  members: OrganizationMember[]
  contests: OrganizationContest[]
  submissions: OrganizationSubmission[]
}

const pythonMembers: OrganizationMember[] = [
  { username: 'baodzai', fullName: 'Nguyễn Gia Bảo', score: 1840.5, solved: 212, role: 'Quản trị viên' },
  { username: 'minhanh', fullName: 'Trần Minh Anh', score: 1622.25, solved: 187, role: 'Thành viên' },
  { username: 'hoangnam', fullName: 'Lê Hoàng Nam', score: 1498.0, solved: 171, role: 'Thành viên' },
  { username: 'thuytien', fullName: 'Phạm Thủy Tiên', score: 1310.75, solved: 149, role: 'Thành viên' },
  { username: 'quangvinh', fullName: 'Đỗ Quang Vinh', score: 1204.4, solved: 133, role: 'Thành viên' },
  { username: 'ngocmai', fullName: 'Vũ Ngọc Mai', score: 1118.9, solved: 126, role: 'Thành viên' },
  { username: 'tuanhung', fullName: 'Bùi Tuấn Hưng', score: 987.15, solved: 108, role: 'Thành viên' },
  { username: 'khanhlinh', fullName: 'Hoàng Khánh Linh', score: 905.6, solved: 97, role: 'Thành viên' },
]

const pythonSubmissions: OrganizationSubmission[] = [
  { id: 'org-py-1', problemId: 'PY006', username: 'minhanh', status: 'AC', language: 'Python 3', runtimeMs: 31, submittedAt: '10 phút trước' },
  { id: 'org-py-2', problemId: 'PY009', username: 'hoangnam', status: 'WA', language: 'Python 3', runtimeMs: 54, submittedAt: '24 phút trước' },
  { id: 'org-py-3', problemId: 'PY007', username: 'thuytien', status: 'AC', language: 'Python 3', runtimeMs: 28, submittedAt: '41 phút trước' },
  { id: 'org-py-4', problemId: 'PY012', username: 'quangvinh', status: 'TLE', language: 'Python 3', runtimeMs: 1000, submittedAt: '1 giờ trước' },
  { id: 'org-py-5', problemId: 'PY010', username: 'ngocmai', status: 'AC', language: 'Python 3', runtimeMs: 22, submittedAt: '2 giờ trước' },
  { id: 'org-py-6', problemId: 'PY005', username: 'tuanhung', status: 'RE', language: 'Python 3', runtimeMs: 18, submittedAt: '3 giờ trước' },
]

const sharedContests: OrganizationContest[] = [
  { id: 'weekly-01', title: 'Contest tuần 01 – Khởi động', startsAt: '25/10/2026 19:30', duration: '90 phút', participants: 0, status: 'Sắp diễn ra' },
  { id: 'midterm', title: 'Kiểm tra giữa kỳ', startsAt: '12/10/2026 19:00', duration: '120 phút', participants: 318, status: 'Đã kết thúc' },
  { id: 'weekly-00', title: 'Contest tuần 00 – Làm quen', startsAt: '05/10/2026 19:30', duration: '60 phút', participants: 402, status: 'Đã kết thúc' },
]

export const organizations: Organization[] = [
  {
    id: 'python', name: 'PYTHON', fullName: 'Câu lạc bộ Lập trình Python UTH',
    description: 'Nơi luyện tập Python từ cơ bản đến nâng cao dành cho sinh viên UTH.',
    score: 1122.82, memberCount: 1242, joined: true,
    problemIds: ['PY001', 'PY002', 'PY003', 'PY004', 'PY005', 'PY006', 'PY007', 'PY008', 'PY009', 'PY010', 'PY011', 'PY012'],
    members: pythonMembers, contests: sharedContests, submissions: pythonSubmissions,
  },
  {
    id: 'cpp-uth', name: 'CPP-UTH', fullName: 'Lập trình C++ và cấu trúc dữ liệu',
    description: 'Luyện C++ với STL, cấu trúc dữ liệu và giải thuật.',
    score: 1544.3, memberCount: 986, joined: false,
    problemIds: ['UTH001', 'UTH002', 'UTH003', 'UTH005'], members: pythonMembers.slice(2, 6), contests: sharedContests.slice(0, 1), submissions: [],
  },
  {
    id: 'algo-pro', name: 'ALGO-PRO', fullName: 'Thuật toán nâng cao',
    description: 'Quy hoạch động, đồ thị và các chủ đề thi Olympic.',
    score: 2310.75, memberCount: 512, joined: false,
    problemIds: ['UTH004', 'UTH006', 'UTH007', 'UTH012'], members: pythonMembers.slice(0, 4), contests: sharedContests.slice(1), submissions: [],
  },
  {
    id: 'java-core', name: 'JAVA-CORE', fullName: 'Java hướng đối tượng',
    description: 'Thực hành Java và lập trình hướng đối tượng.',
    score: 874.2, memberCount: 640, joined: false,
    problemIds: ['UTH008', 'UTH009'], members: pythonMembers.slice(3, 7), contests: [], submissions: [],
  },
  {
    id: 'web-club', name: 'WEB-CLUB', fullName: 'Câu lạc bộ Phát triển Web',
    description: 'Chia sẻ kiến thức web và các bài tập tư duy lập trình.',
    score: 612.4, memberCount: 355, joined: false,
    problemIds: ['UTH001', 'UTH010'], members: pythonMembers.slice(1, 4), contests: [], submissions: [],
  },
  {
    id: 'olympic-tin', name: 'OLYMPIC-TIN', fullName: 'Đội tuyển Olympic Tin học',
    description: 'Đội tuyển luyện thi Olympic Tin học sinh viên toàn quốc.',
    score: 2988.1, memberCount: 128, joined: false,
    problemIds: ['UTH013', 'UTH014', 'UTH015', 'UTH017'], members: pythonMembers.slice(0, 3), contests: sharedContests.slice(0, 2), submissions: [],
  },
]

export const getOrganization = (id: string) => organizations.find((organization) => organization.id === id.toLowerCase())

export type OrganizationTab = 'home' | 'members' | 'problems' | 'contests' | 'submissions'

export const organizationTabs: { key: OrganizationTab; label: string; path: string }[] = [
  { key: 'home', label: 'Trang chủ', path: '' },
  { key: 'members', label: 'Thành viên', path: '/members' },
  { key: 'problems', label: 'Danh sách bài', path: '/problems' },
  { key: 'contests', label: 'Danh sách kỳ thi', path: '/contests' },
  { key: 'submissions', label: 'Các bài nộp', path: '/submissions' },
]
