// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from './AdminDashboardPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  user: { full_name: 'Nguyễn Admin', username: 'admin' },
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

const dataByPath: Record<string, unknown> = {
  '/admin/dashboard': {
    total: 32,
    published: 24,
    draft: 5,
    archived: 3,
    recent: [],
  },
  '/admin/users?page=1&pageSize=1': {
    items: [],
    total: 128,
    page: 1,
    pageSize: 1,
  },
  '/admin/contests/overview': {
    total: 7,
    draft: 2,
    published: 4,
    archived: 1,
    upcoming: 2,
    ongoing: 1,
    ended: 1,
  },
  '/admin/news?page=1&pageSize=1': {
    items: [],
    total: 25,
    page: 1,
    pageSize: 1,
  },
  '/admin/organizations?page=1&pageSize=1&sort=newest': {
    items: [],
    total: 11,
    page: 1,
    pageSize: 1,
  },
  '/admin/contact-messages?page=1&pageSize=1': {
    items: [],
    total: 1,
    page: 1,
    pageSize: 1,
    statistics: { total: 49, NEW: 20, IN_PROGRESS: 15, RESOLVED: 14 },
  },
  '/admin/dashboard/statistics?days=30&submissionScope=GLOBAL': {
    timezone: 'Asia/Ho_Chi_Minh',
    days: 30,
    submissionScope: 'GLOBAL',
    submissions: {
      total: 3,
      daily: [
        { date: '2026-11-09', count: 0 },
        { date: '2026-11-10', count: 3 },
      ],
    },
    users: {
      total: 2,
      daily: [
        { date: '2026-11-09', count: 2 },
        { date: '2026-11-10', count: 0 },
      ],
    },
  },
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.request.mockImplementation((path: string) => Promise.resolve(dataByPath[path]))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mocks.request.mockReset()
})

async function renderDashboard() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    )
    await Promise.resolve()
  })
}

describe('AdminDashboardPage', () => {
  it('loads six summary metrics in order and keeps both charts', async () => {
    await renderDashboard()

    const cards = Array.from(container.querySelectorAll('[aria-label="Chỉ số tổng quan"] article'))
    expect(cards).toHaveLength(6)
    expect(cards.map((card) => card.querySelector('p')?.textContent)).toEqual([
      'Tổng số bài tập',
      'Tổng số cuộc thi',
      'Tổng số tin tức',
      'Tổng số người dùng',
      'Tổng số tổ chức',
      'Tổng số tin nhắn',
    ])
    expect(cards.map((card) => card.querySelector('strong')?.textContent)).toEqual([
      '32',
      '7',
      '25',
      '128',
      '11',
      '49',
    ])
    expect(cards.map((card) => card.querySelector('svg')?.getAttribute('class'))).toEqual([
      expect.stringContaining('lucide-book-open'),
      expect.stringContaining('lucide-trophy'),
      expect.stringContaining('lucide-newspaper'),
      expect.stringContaining('lucide-users'),
      expect.stringContaining('lucide-building-2'),
      expect.stringContaining('lucide-mail'),
    ])
    expect(container.querySelectorAll('article')).toHaveLength(8)
    expect(container.querySelector('h1, time')).toBeNull()
    expect(container.textContent).toContain('Xu hướng bài nộp công khai')
    expect(container.textContent).toContain(
      'Số bài nộp trên các bài tập Global đã xuất bản trong khoảng thời gian được chọn.',
    )
    expect(container.textContent).toContain('Tăng trưởng người dùng')
    expect(container.textContent).toContain('Bài nộp Global')
    expect(container.textContent).toContain('Tài khoản đăng ký mới')
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2)
    expect(container.textContent).toContain('Xem dữ liệu dạng bảng')
    expect(container.textContent).not.toContain('Tình hình cuộc thi')
    expect(container.textContent).not.toContain('Truy cập quản trị')
    expect(container.textContent).not.toContain('Bài tập cập nhật gần đây')
    const requestedPaths = mocks.request.mock.calls.map(([path]) => path)
    for (const path of [
      '/admin/dashboard',
      '/admin/contests/overview',
      '/admin/news?page=1&pageSize=1',
      '/admin/users?page=1&pageSize=1',
      '/admin/organizations?page=1&pageSize=1&sort=newest',
      '/admin/contact-messages?page=1&pageSize=1',
      '/admin/dashboard/statistics?days=30&submissionScope=GLOBAL',
    ]) {
      expect(requestedPaths).toContain(path)
    }
    expect(requestedPaths).not.toContain('/public/stats')
  })

  it('requests selected date ranges and submission scope', async () => {
    await renderDashboard()
    const metricCards = container.querySelectorAll('[aria-label="Chỉ số tổng quan"] article')
    const valuesBeforeFilterChange = Array.from(metricCards, (card) => card.querySelector('strong')?.textContent)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')?.click()
      const scope = container.querySelector<HTMLSelectElement>('select[aria-label="Phạm vi bài nộp"]')
      if (scope) {
        scope.value = 'ORGANIZATION'
        scope.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mocks.request).toHaveBeenCalledWith(
      '/admin/dashboard/statistics?days=7&submissionScope=ORGANIZATION',
    )
    expect(container.textContent).toContain('Bài nộp Organization')
    expect(container.textContent).toContain('Xu hướng bài nộp')
    expect(container.textContent).not.toContain('Xu hướng bài nộp công khai')
    expect(container.textContent).not.toContain('Số bài nộp trên các bài tập Global')
    expect(Array.from(metricCards, (card) => card.querySelector('strong')?.textContent))
      .toEqual(valuesBeforeFilterChange)
    for (const path of [
      '/admin/dashboard',
      '/admin/contests/overview',
      '/admin/news?page=1&pageSize=1',
      '/admin/users?page=1&pageSize=1',
      '/admin/organizations?page=1&pageSize=1&sort=newest',
      '/admin/contact-messages?page=1&pageSize=1',
    ]) {
      expect(mocks.request.mock.calls.filter(([requestedPath]) => requestedPath === path)).toHaveLength(1)
    }
  })

  it('keeps the chart ready when the active period is selected again', async () => {
    await renderDashboard()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.click()
    })

    expect(container.querySelector('[aria-label="Đang tải xu hướng bài nộp công khai"]')).toBeNull()
    expect(mocks.request.mock.calls.filter(([path]) =>
      typeof path === 'string' && path.startsWith('/admin/dashboard/statistics'),
    )).toHaveLength(1)
  })

  it('shows loading skeletons while chart statistics are pending', async () => {
    let resolveStatistics!: (data: unknown) => void
    mocks.request.mockImplementation((path: string) => {
      if (path.startsWith('/admin/dashboard/statistics')) {
        return new Promise((resolve) => {
          resolveStatistics = resolve
        })
      }
      return Promise.resolve(dataByPath[path])
    })
    await renderDashboard()

    expect(container.querySelector('[aria-label="Đang tải xu hướng bài nộp công khai"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Đang tải tăng trưởng người dùng"]')).not.toBeNull()

    await act(async () => {
      resolveStatistics(dataByPath['/admin/dashboard/statistics?days=30&submissionScope=GLOBAL'])
      await Promise.resolve()
    })
  })

  it('shows an analytics error and offers a retry', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path.startsWith('/admin/dashboard/statistics')) {
        return Promise.reject(new Error('offline'))
      }
      return Promise.resolve(dataByPath[path])
    })
    await renderDashboard()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Chưa thể tải biểu đồ')
    const retryButtons = container.querySelectorAll<HTMLButtonElement>('button')
    expect(Array.from(retryButtons).some((button) => button.textContent?.includes('Thử lại'))).toBe(true)
  })

  it('shows an empty state when the selected period has no events', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path.startsWith('/admin/dashboard/statistics')) {
        return Promise.resolve({
          timezone: 'Asia/Ho_Chi_Minh',
          days: 30,
          submissionScope: 'GLOBAL',
          submissions: { total: 0, daily: [] },
          users: { total: 0, daily: [] },
        })
      }
      return Promise.resolve(dataByPath[path])
    })
    await renderDashboard()

    expect(container.textContent).toContain('Chưa có bài nộp trong khoảng thời gian này.')
    expect(container.textContent).toContain('Chưa có người dùng mới trong khoảng thời gian này.')
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0)
  })

  it('keeps other metrics visible when one request fails and retries that metric', async () => {
    const newsPath = '/admin/news?page=1&pageSize=1'
    let failNewsRequest = true
    mocks.request.mockImplementation((path: string) => {
      if (path === newsPath && failNewsRequest) {
        failNewsRequest = false
        return Promise.reject(new Error('offline'))
      }
      return Promise.resolve(dataByPath[path])
    })
    await renderDashboard()

    const newsCard = container.querySelectorAll('[aria-label="Chỉ số tổng quan"] article')[2]
    expect(newsCard?.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải')
    expect(newsCard?.querySelector('strong')).toBeNull()
    expect(container.querySelector('[aria-label="Chỉ số tổng quan"]')?.textContent).toContain('128')
    expect(container.querySelector('[aria-label="Chỉ số tổng quan"]')?.textContent).toContain('49')
    const retry = newsCard?.querySelector<HTMLButtonElement>(
      'button[aria-label="Thử tải lại tổng số tin tức"]',
    )

    await act(async () => {
      retry?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(newsCard?.querySelector('[role="alert"]')).toBeNull()
    expect(newsCard?.querySelector('strong')?.textContent).toBe('25')
    expect(mocks.request.mock.calls.filter(([path]) => path === newsPath)).toHaveLength(2)
  })

  it('shows a per-card skeleton without showing a placeholder zero', async () => {
    const newsPath = '/admin/news?page=1&pageSize=1'
    let resolveNews!: (result: unknown) => void
    mocks.request.mockImplementation((path: string) => {
      if (path === newsPath) {
        return new Promise((resolve) => {
          resolveNews = resolve
        })
      }
      return Promise.resolve(dataByPath[path])
    })

    await renderDashboard()
    const newsCard = container.querySelectorAll('[aria-label="Chỉ số tổng quan"] article')[2]
    expect(newsCard?.querySelector('[role="status"][aria-label="Đang tải tổng số tin tức"]')).not.toBeNull()
    expect(newsCard?.querySelector('strong')).toBeNull()
    expect(newsCard?.textContent).not.toContain('0')

    await act(async () => {
      resolveNews(dataByPath[newsPath])
      await Promise.resolve()
    })
    expect(newsCard?.querySelector('strong')?.textContent).toBe('25')
  })
})
