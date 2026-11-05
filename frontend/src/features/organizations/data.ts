export interface Organization {
  id: string
  name: string
  logoUrl?: string | null
  score: number
  memberCount: number
}

export interface OrganizationsPageResult {
  items: Organization[]
  total: number
}

// Mock data: replace with an API call returning the same shape when the backend is ready.
export const mockOrganizations: Organization[] = [
  { id: 'uth-cit', name: 'UTH - Khoa Công nghệ thông tin', score: 4820, memberCount: 312 },
  { id: 'uth-algo-club', name: 'CLB Thuật toán UTH', score: 4310, memberCount: 148 },
  { id: 'uth-cp-team', name: 'UTH Competitive Programming Team', score: 3975, memberCount: 64 },
  { id: 'uth-se', name: 'UTH - Bộ môn Kỹ thuật phần mềm', score: 3640, memberCount: 205 },
  { id: 'uth-ai-lab', name: 'UTH AI Lab', score: 3320, memberCount: 87 },
  { id: 'uth-cs-k22', name: 'Khoa học máy tính K22', score: 3105, memberCount: 176 },
  { id: 'uth-it-k23', name: 'Công nghệ thông tin K23', score: 2890, memberCount: 238 },
  { id: 'uth-code-night', name: 'UTH Code Night', score: 2745, memberCount: 92 },
  { id: 'uth-web-club', name: 'CLB Lập trình Web', score: 2510, memberCount: 119 },
  { id: 'uth-mobile-club', name: 'CLB Lập trình Di động', score: 2260, memberCount: 73 },
  { id: 'uth-data-science', name: 'UTH Data Science Group', score: 2085, memberCount: 58 },
  { id: 'uth-cyber', name: 'CLB An toàn thông tin', score: 1940, memberCount: 66 },
  { id: 'uth-iot', name: 'UTH IoT & Embedded', score: 1780, memberCount: 49 },
  { id: 'uth-logistics-it', name: 'Tin học Logistics UTH', score: 1655, memberCount: 131 },
  { id: 'uth-transport-it', name: 'Hệ thống thông tin Giao thông', score: 1490, memberCount: 102 },
  { id: 'uth-olympic', name: 'Đội tuyển Olympic Tin học', score: 1385, memberCount: 24 },
  { id: 'uth-first-year', name: 'Sinh viên năm nhất CNTT', score: 1210, memberCount: 264 },
  { id: 'uth-hackathon', name: 'UTH Hackathon Crew', score: 1095, memberCount: 55 },
  { id: 'uth-open-source', name: 'UTH Open Source Community', score: 980, memberCount: 41 },
  { id: 'uth-game-dev', name: 'CLB Phát triển Game', score: 845, memberCount: 38 },
  { id: 'uth-cloud', name: 'UTH Cloud & DevOps', score: 720, memberCount: 33 },
  { id: 'uth-robotics', name: 'CLB Robotics', score: 610, memberCount: 29 },
  { id: 'uth-math-code', name: 'Toán - Tin ứng dụng', score: 495, memberCount: 47 },
  { id: 'uth-alumni', name: 'Cựu sinh viên UTH IT', score: 380, memberCount: 83 },
  { id: 'uth-study-group', name: 'Nhóm tự học Cấu trúc dữ liệu', score: 240, memberCount: 21 },
  { id: 'uth-newcomers', name: 'UTH Newcomers', score: 120, memberCount: 18 },
]

export function getOrganizationsPage({
  page,
  pageSize,
  q,
}: {
  page: number
  pageSize: number
  q: string
}): OrganizationsPageResult {
  const keyword = q.trim().toLocaleLowerCase('vi')
  const filtered = keyword
    ? mockOrganizations.filter((item) => item.name.toLocaleLowerCase('vi').includes(keyword))
    : mockOrganizations
  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), total: filtered.length }
}
