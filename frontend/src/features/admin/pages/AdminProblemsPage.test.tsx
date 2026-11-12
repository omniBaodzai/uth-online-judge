// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProblemsPage from './AdminProblemsPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  setNotice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request, setNotice: mocks.setNotice }),
}))

function problem(id: string, code: string, status: 'draft' | 'published' | 'archived') {
  return {
    id,
    code,
    title: `Bài tập ${code}`,
    summary: 'Mô tả ngắn',
    illustrationUrl: null,
    illustrationWidth: 100,
    illustrationAspectRatio: 'auto' as const,
    illustrationAlignment: 'center' as const,
    statement: 'Nội dung',
    difficulty: 'easy' as const,
    tags: ['Mảng', 'Cơ bản'],
    languages: ['C++'],
    inputDescription: '',
    outputDescription: '',
    constraints: '',
    timeLimitSeconds: 1,
    memoryLimitMb: 128,
    scoringEnabled: false,
    score: 100,
    testCaseRevision: 1,
    examples: [],
    editorials: [],
    status,
    updatedAt: '2026-11-11T09:00:00.000Z',
  }
}

const problems = [
  problem('draft-id', 'DRAFT_01', 'draft'),
  problem('published-id', 'PUB_01', 'published'),
  problem('archived-id', 'ARC_01', 'archived'),
]

const dashboard = {
  total: 43,
  published: 23,
  draft: 12,
  archived: 8,
  recent: [],
}

let root: Root
let container: HTMLDivElement
let totalRecords = 3
let decrementOnDelete = false

function listPageFor(path: string) {
  const query = new URLSearchParams(path.slice(path.indexOf('?') + 1))
  const requestedPage = Number(query.get('page') ?? 1)
  const requestedPageSize = Number(query.get('pageSize') ?? 20)
  const firstIndex = (requestedPage - 1) * requestedPageSize
  const itemCount = Math.max(0, Math.min(requestedPageSize, totalRecords - firstIndex))

  return {
    items: Array.from({ length: itemCount }, (_, offset) => {
      const index = firstIndex + offset
      return problems[index] ?? problem(
        `generated-${index + 1}`,
        `GEN_${String(index + 1).padStart(2, '0')}`,
        'draft',
      )
    }),
    total: totalRecords,
    page: requestedPage,
    pageSize: requestedPageSize,
  }
}

async function changeControl(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value)
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  totalRecords = 3
  decrementOnDelete = false
  mocks.request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/admin/dashboard') return Promise.resolve(dashboard)
    if (path.startsWith('/admin/problems?')) return Promise.resolve(listPageFor(path))
    if (path.startsWith('/admin/problems/') && options?.method === 'DELETE') {
      if (decrementOnDelete) totalRecords = Math.max(0, totalRecords - 1)
      return Promise.resolve(undefined)
    }
    return Promise.resolve(undefined)
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mocks.request.mockReset()
  mocks.setNotice.mockReset()
})

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminProblemsPage />
      </MemoryRouter>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('AdminProblemsPage', () => {
  it('uses all-status server totals and keeps the create action below four KPI cards', async () => {
    await renderPage()

    const metrics = container.querySelector('[aria-label="Tổng quan bài tập"]')
    expect(metrics?.textContent).toContain('Tổng bài tập')
    expect(metrics?.textContent).toContain('43')
    expect(metrics?.textContent).toContain('Đã xuất bản')
    expect(metrics?.textContent).toContain('23')
    expect(metrics?.textContent).toContain('Bản nháp')
    expect(metrics?.textContent).toContain('12')
    expect(metrics?.textContent).toContain('Đã lưu trữ')
    expect(metrics?.textContent).toContain('8')
    expect(metrics?.querySelectorAll('article')).toHaveLength(4)
    expect(container.querySelector('a[href="/admin/problems/new"]')).not.toBeNull()
    expect(mocks.request).toHaveBeenCalledWith('/admin/dashboard')
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=20')
    expect(Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent)).toEqual([
      'MÃ BÀI',
      'TÊN BÀI',
      'CHỦ ĐỀ',
      'TRẠNG THÁI',
      'CẬP NHẬT',
      'THAO TÁC',
    ])
    const pagers = container.querySelectorAll('nav[aria-label^="Phân trang danh sách bài tập"]')
    expect(pagers).toHaveLength(2)
    for (const pager of pagers) {
      expect(pager.textContent).toContain('Trang 1 / 1')
      expect(pager.textContent).toContain('3 bài tập')
    }
  })

  it('keeps the top and bottom pagers synchronized for page and page-size changes', async () => {
    totalRecords = 45
    await renderPage()

    const pagers = container.querySelectorAll<HTMLElement>('nav[aria-label^="Phân trang danh sách bài tập"]')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].querySelectorAll('option')).toHaveLength(3)

    await changeControl(
      pagers[0].querySelector<HTMLSelectElement>('select')!,
      '10',
    )
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=10')
    for (const pager of pagers) {
      expect(pager.textContent).toContain('Trang 1 / 5')
      expect(pager.querySelector<HTMLSelectElement>('select')?.value).toBe('10')
    }

    await act(async () => {
      pagers[1].querySelector<HTMLButtonElement>('[aria-label^="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=2&pageSize=10')
    for (const pager of pagers) expect(pager.textContent).toContain('Trang 2 / 5')

    await changeControl(pagers[1].querySelector<HTMLSelectElement>('select')!, '50')
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=50')
    for (const pager of pagers) {
      expect(pager.textContent).toContain('Trang 1 / 1')
      expect(pager.querySelector<HTMLSelectElement>('select')?.value).toBe('50')
    }
  })

  it('resets to page one when the search or status filter changes', async () => {
    totalRecords = 45
    await renderPage()

    const bottomPager = container.querySelector<HTMLElement>(
      'nav[aria-label="Phân trang danh sách bài tập phía dưới"]',
    )!
    await changeControl(
      container.querySelector<HTMLSelectElement>('nav select')!,
      '10',
    )
    await act(async () => {
      bottomPager.querySelector<HTMLButtonElement>('[aria-label^="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(bottomPager.textContent).toContain('Trang 2 / 5')

    await changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Lọc theo trạng thái"]')!, 'published')
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=10&status=published')
    expect(bottomPager.textContent).toContain('Trang 1 / 5')

    await act(async () => {
      bottomPager.querySelector<HTMLButtonElement>('[aria-label^="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await changeControl(container.querySelector<HTMLInputElement>('input[aria-label="Tìm theo mã hoặc tên bài tập"]')!, 'GEN')
    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=10&search=GEN&status=published')
    expect(bottomPager.textContent).toContain('Trang 1 / 5')
  })

  it('moves back to the last available page when the record total shrinks', async () => {
    totalRecords = 21
    decrementOnDelete = true
    await renderPage()

    const bottomPager = container.querySelector<HTMLElement>(
      'nav[aria-label="Phân trang danh sách bài tập phía dưới"]',
    )!
    await changeControl(
      container.querySelector<HTMLSelectElement>('nav select')!,
      '10',
    )
    for (let index = 0; index < 2; index += 1) {
      await act(async () => {
        bottomPager.querySelector<HTMLButtonElement>('[aria-label^="Trang sau"]')?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
    expect(bottomPager.textContent).toContain('Trang 3 / 3')
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Xóa GEN_21"]')).not.toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Xóa GEN_21"]')?.click()
    })
    await act(async () => {
      const dialog = container.querySelector('[role="dialog"]')
      Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find((button) => button.textContent?.includes('Xóa vĩnh viễn'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mocks.request).toHaveBeenCalledWith('/admin/problems?page=2&pageSize=10')
    const pagers = container.querySelectorAll('nav[aria-label^="Phân trang danh sách bài tập"]')
    for (const pager of pagers) {
      expect(pager.textContent).toContain('Trang 2 / 2')
      expect(pager.textContent).toContain('11–20 / 20 bài tập')
    }
  })

  it('allows delete only for drafts and explains the existing API policy for other statuses', async () => {
    await renderPage()

    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Xóa DRAFT_01"]')?.disabled).toBe(false)
    expect(container.querySelector<HTMLButtonElement>('button[aria-label^="Không thể xóa PUB_01"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('button[aria-label^="Không thể xóa ARC_01"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('button[aria-label^="Không thể xóa PUB_01"]')?.title)
      .toContain('chỉ cho phép xóa bài tập ở trạng thái bản nháp')
  })

  it('shows a destructive confirmation with the problem identity and existing data constraints', async () => {
    await renderPage()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Xóa DRAFT_01"]')?.click()
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('DRAFT_01 — Bài tập DRAFT_01')
    expect(dialog?.textContent).toContain('bài nộp')
    expect(dialog?.textContent).toContain('kỳ thi')
    expect(dialog?.textContent).toContain('ràng buộc hiện hành')
    expect(mocks.request.mock.calls.some(([path, options]) =>
      path === '/admin/problems/draft-id' && options?.method === 'DELETE',
    )).toBe(false)
  })

  it('deletes a confirmed draft through the existing API and refreshes the counts and list', async () => {
    await renderPage()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Xóa DRAFT_01"]')?.click()
    })
    await act(async () => {
      const dialog = container.querySelector('[role="dialog"]')
      Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find((button) => button.textContent?.includes('Xóa vĩnh viễn'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(mocks.request).toHaveBeenCalledWith('/admin/problems/draft-id', { method: 'DELETE' })
    expect(mocks.setNotice).toHaveBeenCalledWith('Đã xóa bài tập “DRAFT_01”.')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/dashboard')).toHaveLength(2)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows a recoverable list error and a helpful empty state', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path === '/admin/dashboard') return Promise.resolve(dashboard)
      return Promise.reject(new Error('offline'))
    })
    await renderPage()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải danh sách bài tập')
    expect(container.textContent).toContain('Thử lại')
  })

  it('shows a useful empty state when the current filter has no matches', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path === '/admin/dashboard') return Promise.resolve(dashboard)
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 })
    })
    await renderPage()

    expect(container.textContent).toContain('Chưa có bài tập nào')
    expect(container.textContent).toContain('Tạo bài tập đầu tiên')
  })
})
