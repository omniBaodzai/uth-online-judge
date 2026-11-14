// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import AdminNewsPage from './AdminNewsPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  setNotice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request, setNotice: mocks.setNotice }),
}))

const statusTotals = { DRAFT: 12, PUBLISHED: 33 }
const totalRecords = 45

function article(index: number, status: 'DRAFT' | 'PUBLISHED') {
  return {
    id: `news-${index + 1}`,
    slug: `news-${index + 1}`,
    title: `Tin tức ${index + 1}`,
    summary: 'Cập nhật mới từ UTH Online Judge.',
    category: 'Thông báo',
    authorName: 'Ban quản trị',
    publishedAt: status === 'PUBLISHED' ? '2026-11-12T08:00:00.000Z' : null,
    status,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-12T09:00:00.000Z',
  }
}

function pageFor(path: string) {
  const query = new URLSearchParams(path.slice(path.indexOf('?') + 1))
  const requestedPage = Number(query.get('page') ?? 1)
  const requestedPageSize = Number(query.get('pageSize') ?? 10)
  const status = query.get('status') as keyof typeof statusTotals | null
  const total = status ? statusTotals[status] : totalRecords
  const firstIndex = (requestedPage - 1) * requestedPageSize
  const itemCount = Math.max(0, Math.min(requestedPageSize, total - firstIndex))

  return {
    items: Array.from({ length: itemCount }, (_, offset) => {
      const index = firstIndex + offset
      return article(index, status ?? (index % 2 === 0 ? 'PUBLISHED' : 'DRAFT'))
    }),
    total,
    page: requestedPage,
    pageSize: requestedPageSize,
  }
}

let root: Root
let container: HTMLDivElement

async function changeControl(
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
  waitMs = 0,
) {
  await act(async () => {
    const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value)
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  })
}

async function renderPage() {
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AdminNewsPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function settleUpdates() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await i18n.changeLanguage('vi')
  mocks.request.mockImplementation((path: string) => Promise.resolve(pageFor(path)))
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

describe('AdminNewsPage', () => {
  it('uses API totals for status cards and preserves only real news statuses', async () => {
    await renderPage()

    const metrics = container.querySelector('[aria-label="Thống kê tin tức"]')
    expect(metrics?.querySelectorAll('article')).toHaveLength(4)
    expect(metrics?.textContent).toContain('Tổng tin tức')
    expect(metrics?.textContent).toContain('45')
    expect(metrics?.textContent).toContain('Đã xuất bản')
    expect(metrics?.textContent).toContain('33')
    expect(metrics?.textContent).toContain('Bản nháp')
    expect(metrics?.textContent).toContain('12')
    expect(metrics?.textContent).toContain('Tỷ lệ xuất bản')
    expect(metrics?.textContent).toContain('73%')
    expect(Array.from(metrics?.querySelectorAll('article') ?? []).map((card) =>
      Array.from(card.children).map((child) => child.tagName),
    )).toEqual(Array.from({ length: 4 }, () => ['SPAN', 'P', 'STRONG']))
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=1')
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=1&status=DRAFT')
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=1&status=PUBLISHED')

    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).not.toContain('NỘI DUNG CỘNG ĐỒNG')
    expect(container.textContent).not.toContain('Quản lý tin tức')
    expect(container.textContent).not.toContain('Soạn, xuất bản và quản lý tin tức chính thức')
    expect(container.querySelector<HTMLAnchorElement>('a[href="/admin/news/new"]')).not.toBeNull()
    expect(Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent)).toEqual([
      'TIÊU ĐỀ',
      'DANH MỤC',
      'TRẠNG THÁI',
      'XUẤT BẢN',
      'CẬP NHẬT',
      'THAO TÁC',
    ])
    expect(container.querySelector('option[value="ARCHIVED"]')).toBeNull()
  })

  it('keeps both pagers synchronized and uses the existing page-size options', async () => {
    await renderPage()

    let pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].parentElement?.querySelector('p')?.textContent).toContain('Hiển thị 1–20 trên 45 bài viết')
    expect(pagers[0].parentElement?.querySelector('select')).toBeNull()
    const pageSizeSelect = pagers[1].parentElement!.querySelector<HTMLSelectElement>('select')!
    expect(Array.from(pageSizeSelect.options).map((option) => option.value)).toEqual(['10', '20', '50'])
    expect(pagers[0].querySelector('[aria-current="page"]')?.textContent).toBe('1')
    expect(pagers[1].querySelector('[aria-label="Trang trước"]')?.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      pagers[1].querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=2&pageSize=20')
    pagers = container.querySelectorAll<HTMLElement>('nav')
    for (const pager of pagers) {
      expect(pager.querySelector('[aria-current="page"]')?.textContent, pager.textContent ?? '').toBe('2')
      expect(pager.parentElement?.querySelector('p')?.textContent).toContain('Hiển thị 21–40 trên 45 bài viết')
    }

    await changeControl(pageSizeSelect, '50')
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=50')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/news?page=1&pageSize=50')).toHaveLength(1)
    pagers = container.querySelectorAll<HTMLElement>('nav')
    for (const pager of pagers) {
      expect(pager.querySelector('[aria-current="page"]')?.textContent).toBe('1')
      expect(pager.parentElement?.querySelector('p')?.textContent).toContain('Hiển thị 1–45 trên 45 bài viết')
    }
    expect(pageSizeSelect.value).toBe('50')
  })

  it('resets to page one on filter and debounced search without duplicate list requests', async () => {
    await renderPage()

    let bottomPager = container.querySelectorAll<HTMLElement>('nav')[1]
    const pageSizeSelect = bottomPager.parentElement!.querySelector<HTMLSelectElement>('select')!
    await changeControl(pageSizeSelect, '10')
    await act(async () => {
      bottomPager.querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()

    await changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Lọc theo trạng thái"]')!, 'PUBLISHED')
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=10&status=PUBLISHED')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/news?page=1&pageSize=10&status=PUBLISHED')).toHaveLength(1)
    bottomPager = container.querySelectorAll<HTMLElement>('nav')[1]
    expect(bottomPager.querySelector('[aria-current="page"]')?.textContent).toBe('1')

    await act(async () => {
      bottomPager.querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    await changeControl(
      container.querySelector<HTMLInputElement>('input[aria-label="Tìm theo tiêu đề hoặc tóm tắt"]')!,
      'UTH',
      350,
    )
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=10&q=UTH&status=PUBLISHED')
    expect(mocks.request.mock.calls.filter(([path]) =>
      path === '/admin/news?page=1&pageSize=10&q=UTH&status=PUBLISHED',
    )).toHaveLength(1)
    expect(bottomPager.querySelector('[aria-current="page"]')?.textContent).toBe('1')

    const callsBeforeClear = mocks.request.mock.calls.filter(([path]) => path === '/admin/news?page=1&pageSize=10').length
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Xóa bộ lọc'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/news?page=1&pageSize=10')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/news?page=1&pageSize=10')).toHaveLength(callsBeforeClear + 1)
  })

  it('shows no pager for empty results and does not invent an archived status', async () => {
    mocks.request.mockImplementation((path: string) => {
      const result = pageFor(path)
      return Promise.resolve({ ...result, items: [], total: 0 })
    })
    await renderPage()

    expect(container.textContent).toContain('Chưa có bài viết phù hợp')
    expect(container.querySelectorAll('nav')).toHaveLength(0)
    expect(container.querySelector('option[value="ARCHIVED"]')).toBeNull()
  })

  it('reports statistics failures instead of displaying page item counts as totals', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path.includes('pageSize=1')) return Promise.reject(new Error('offline'))
      return Promise.resolve(pageFor(path))
    })
    await renderPage()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải thống kê tin tức.')
    expect(container.querySelector('[aria-label="Thống kê tin tức"]')?.textContent).toContain('—')
    expect(container.querySelector('[aria-label="Thống kê tin tức"]')?.textContent).not.toContain('45')
  })
})
