import { getContestById } from '../../features/contests/data.ts'

export type BreadcrumbItem = {
  label: string
  to?: string
  dynamic?: boolean
}

export type BreadcrumbOptions = {
  problemCode?: string | null
  from?: string | null
  contestProblem?: {
    contestIdentifier: string
    contestSlug: string
    contestTitle: string
    problemTitle: string
  } | null
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
const adminContestList: BreadcrumbItem = { label: 'Cuộc thi', to: '/admin/contests' }

const newsList: BreadcrumbItem = { label: 'Tin tức', to: '/news' }
const discussionList: BreadcrumbItem = { label: 'Thảo luận', to: '/discussions' }
const leaderboardList: BreadcrumbItem = { label: 'Bảng xếp hạng' }
const adminNewsList: BreadcrumbItem = { label: 'Tin tức', to: '/admin/news' }

function problemDetail(code: string): BreadcrumbItem {
  return {
    label: 'Chi tiết bài tập',
    to: `/problems/${encodeURIComponent(code)}`,
  }
}

function contestProblemCrumbs(
  contestId: string,
  code: string,
  options: BreadcrumbOptions,
  action?: string,
): BreadcrumbItem[] {
  const contest = options.contestProblem?.contestIdentifier === contestId
    ? options.contestProblem
    : null
  const contestSlug = contest?.contestSlug ?? contestId
  const detailPath = `/contests/${encodeURIComponent(contestSlug)}/problems/${encodeURIComponent(code)}`
  const items = [
    home,
    { label: 'Cuộc thi', to: '/contests' },
    {
      label: contest?.contestTitle ?? 'Chi tiết cuộc thi',
      to: `/contests/${encodeURIComponent(contestSlug)}`,
      dynamic: Boolean(contest?.contestTitle),
    },
    {
      label: contest?.problemTitle ?? code,
      ...(action ? { to: detailPath } : {}),
      dynamic: true,
    },
  ]
  return action ? [...items, { label: action }] : items
}

const routes: RouteDefinition[] = [
  {
    pattern: '/contests/:contestId/problems/:code/submit',
    build: ({ contestId, code }, options) =>
      contestProblemCrumbs(contestId, code, options, 'Nộp bài thi'),
  },
  {
    pattern: '/contests/:contestId/problems/:code',
    build: ({ contestId, code }, options) => contestProblemCrumbs(contestId, code, options),
  },
  { pattern: '/problems/:code/submit', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Gửi bài giải' }] },
  { pattern: '/problems/:code/submissions/me', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Bài nộp của tôi' }] },
  { pattern: '/problems/:code/submissions/best', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Bài nộp tốt nhất' }] },
  { pattern: '/problems/:code/best-submissions', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Bài nộp tốt nhất' }] },
  { pattern: '/problems/:code/submissions', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Danh sách bài nộp' }] },
  { pattern: '/problems/:code/solution', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Lời giải bài tập' }] },
  { pattern: '/problems/:code/pdf', build: ({ code }) => [home, problemList, problemDetail(code), { label: 'Đề bài dạng PDF' }] },
  { pattern: '/problems/:code', build: () => [home, problemList, { label: 'Chi tiết bài tập' }] },
  { pattern: '/problems', build: () => [home, { label: 'Bài tập' }] },
  {
    pattern: '/submissions/:submissionId',
    build: (_params, { problemCode, from, contestProblem }) => {
      if (contestProblem && problemCode) {
        const contestSlug = encodeURIComponent(contestProblem.contestSlug)
        const code = encodeURIComponent(problemCode)
        return [
          home,
          { label: 'Cuộc thi', to: '/contests' },
          {
            label: contestProblem.contestTitle,
            to: `/contests/${contestSlug}`,
            dynamic: true,
          },
          {
            label: contestProblem.problemTitle,
            to: `/contests/${contestSlug}/problems/${code}`,
            dynamic: true,
          },
          { label: 'Chi tiết bài nộp' },
        ]
      }
      if (!problemCode) return [home, { label: 'Bài nộp', to: '/submissions' }, { label: 'Chi tiết bài nộp' }]
      const code = encodeURIComponent(problemCode)
      const parent: BreadcrumbItem = from === MY_SUBMISSIONS_SOURCE
        ? { label: 'Bài nộp của tôi', to: `/problems/${code}/submissions/me` }
        : { label: 'Gửi bài giải', to: `/problems/${code}/submit` }
      return [home, problemList, problemDetail(problemCode), parent, { label: 'Chi tiết bài nộp' }]
    },
  },
  { pattern: '/submissions', build: () => [home, { label: 'Bài nộp' }] },
  { pattern: '/news/:slug', build: () => [home, newsList, { label: 'Chi tiết tin tức' }] },
  { pattern: '/news', build: () => [home, { label: 'Tin tức' }] },
  { pattern: '/discussions/new', build: () => [home, discussionList, { label: 'Tạo chủ đề' }] },
  { pattern: '/discussions/:id', build: () => [home, discussionList, { label: 'Chi tiết thảo luận' }] },
  { pattern: '/discussions', build: () => [home, { label: 'Thảo luận' }] },
  { pattern: '/leaderboard', build: () => [home, leaderboardList] },
  { pattern: '/contributors', build: () => [home, { label: 'Top đóng góp' }] },
  { pattern: '/profile/edit', build: () => [home, { label: 'Hồ sơ', to: '/profile' }, { label: 'Chỉnh sửa hồ sơ' }] },
  { pattern: '/profile', build: () => [home, { label: 'Hồ sơ' }] },
  { pattern: '/users/id/:id', build: () => [home, { label: 'Hồ sơ công khai' }] },
  { pattern: '/users/:username', build: () => [home, { label: 'Hồ sơ công khai' }] },
  { pattern: '/contests', build: () => [home, { label: 'Cuộc thi' }] },
  {
    pattern: '/contests/:contestId',
    build: ({ contestId }) => {
      const contestTitle = getContestById(contestId)?.title
      return [
        home,
        { label: 'Cuộc thi', to: '/contests' },
        { label: contestTitle ?? 'Chi tiết cuộc thi', dynamic: Boolean(contestTitle) },
      ]
    },
  },
  { pattern: '/organizations', build: () => [home, { label: 'Tổ chức' }] },
  { pattern: '/contact', build: () => [home, { label: 'Liên hệ' }] },
  { pattern: '/my/contact-messages/:messageId', build: () => [home, { label: 'Liên hệ', to: '/contact' }, { label: 'Chi tiết yêu cầu' }] },
  { pattern: '/admin/problems/new', build: () => [admin, adminProblemList, { label: 'Tạo bài tập' }] },
  { pattern: '/admin/problems/:id/edit', build: () => [admin, adminProblemList, { label: 'Chỉnh sửa bài tập' }] },
  { pattern: '/admin/problems/:id/test-cases', build: () => [admin, adminProblemList, { label: 'Quản lý test case' }] },
  { pattern: '/admin/contests/new', build: () => [admin, adminContestList, { label: 'Tạo cuộc thi' }] },
  { pattern: '/admin/contests/:contestId/edit', build: () => [admin, adminContestList, { label: 'Chỉnh sửa cuộc thi' }] },
  { pattern: '/admin/contests', build: () => [admin, { label: 'Cuộc thi' }] },
  { pattern: '/admin/problems', build: () => [admin, { label: 'Bài tập' }] },
  { pattern: '/admin/news/new', build: () => [admin, adminNewsList, { label: 'Tạo tin tức' }] },
  { pattern: '/admin/news/:id/edit', build: () => [admin, adminNewsList, { label: 'Chỉnh sửa tin tức' }] },
  { pattern: '/admin/contact-messages/:messageId', build: () => [admin, { label: 'Quản lý liên hệ', to: '/admin/contact-messages' }, { label: 'Chi tiết yêu cầu' }] },
  { pattern: '/admin/news', build: () => [admin, { label: 'Tin tức' }] },
  { pattern: '/admin/users', build: () => [admin, { label: 'Người dùng' }] },
  { pattern: '/admin/contact-messages', build: () => [admin, { label: 'Quản lý liên hệ' }] },
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
