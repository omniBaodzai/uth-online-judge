export type BreadcrumbItem = {
  label: string
  to?: string
}

export type BreadcrumbOptions = {
  problemCode?: string | null
  from?: string | null
}

type RouteDefinition = {
  pattern: string
  build: (params: Record<string, string>, options: BreadcrumbOptions) => BreadcrumbItem[]
}

export const MY_SUBMISSIONS_SOURCE = 'my-submissions'

const home: BreadcrumbItem = { label: 'Trang chủ', to: '/' }
const admin: BreadcrumbItem = { label: 'Admin', to: '/admin' }
const problemList: BreadcrumbItem = { label: 'Bài tập', to: '/problems' }
const adminProblemList: BreadcrumbItem = { label: 'Bài tập', to: '/admin/problems' }

function problemDetail(code: string): BreadcrumbItem {
  return {
    label: `Chi tiết bài tập (${code})`,
    to: `/problems/${encodeURIComponent(code)}`,
  }
}

const routes: RouteDefinition[] = [
  { pattern: '/problems/:code/submit', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Gửi bài giải' }] },
  { pattern: '/problems/:code/submissions/me', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Bài nộp của tôi' }] },
  { pattern: '/problems/:code/submissions/best', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Bài nộp tốt nhất' }] },
  { pattern: '/problems/:code/submissions', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Danh sách bài nộp' }] },
  { pattern: '/problems/:code/solution', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Lời giải bài tập' }] },
  { pattern: '/problems/:code/pdf', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Đề bài dạng PDF' }] },
  { pattern: '/problems/:code', build: ({ code }) => [home, problemList, { label: `Chi tiết bài tập (${code})` }] },
  { pattern: '/problems', build: () => [home, { label: 'Bài tập' }] },
  {
    pattern: '/submissions/:submissionId',
    build: (_params, { problemCode, from }) => {
      if (!problemCode) return [home, { label: 'Bài nộp', to: '/submissions' }, { label: 'Chi tiết bài nộp' }]
      const code = encodeURIComponent(problemCode)
      const parent: BreadcrumbItem = from === MY_SUBMISSIONS_SOURCE
        ? { label: 'Bài nộp của tôi', to: `/problems/${code}/submissions/me` }
        : { label: 'Gửi bài giải', to: `/problems/${code}/submit` }
      return [home, problemList, problemDetail(problemCode), parent, { label: 'Chi tiết bài nộp' }]
    },
  },
  { pattern: '/submissions', build: () => [home, { label: 'Bài nộp' }] },
  { pattern: '/profile/edit', build: () => [home, { label: 'Hồ sơ', to: '/profile' }, { label: 'Chỉnh sửa hồ sơ' }] },
  { pattern: '/profile', build: () => [home, { label: 'Hồ sơ' }] },
  { pattern: '/contests', build: () => [home, { label: 'Cuộc thi' }] },
  { pattern: '/organizations', build: () => [home, { label: 'Tổ chức' }] },
  { pattern: '/admin/problems/new', build: () => [admin, adminProblemList, { label: 'Tạo bài tập' }] },
  { pattern: '/admin/problems/:id/edit', build: () => [admin, adminProblemList, { label: 'Chỉnh sửa bài tập' }] },
  { pattern: '/admin/problems/:id/test-cases', build: () => [admin, adminProblemList, { label: 'Quản lý test case' }] },
  { pattern: '/admin/problems', build: () => [admin, { label: 'Bài tập' }] },
  { pattern: '/admin/users', build: () => [admin, { label: 'Người dùng' }] },
  { pattern: '/admin', build: () => [admin, { label: 'Tổng quan' }] },
]

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const routeSegments = pattern.split('/').filter(Boolean)
  const pathSegments = pathname.split('/').filter(Boolean)
  if (routeSegments.length !== pathSegments.length) return null

  const params: Record<string, string> = {}
  for (const [index, routeSegment] of routeSegments.entries()) {
    const pathSegment = pathSegments[index]
    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodePathSegment(pathSegment)
    } else if (routeSegment !== pathSegment) {
      return null
    }
  }
  return params
}

export function getBreadcrumbItems(pathname: string, options: BreadcrumbOptions = {}): BreadcrumbItem[] {
  for (const route of routes) {
    const params = matchRoute(route.pattern, pathname)
    if (params) return route.build(params, options)
  }
  return []
}
