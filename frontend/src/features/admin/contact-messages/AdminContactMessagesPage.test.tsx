// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import AdminContactMessagesPage from './AdminContactMessagesPage'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  request: vi.fn(),
  notice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request, setNotice: mocks.notice }),
}))

vi.mock('../../contact/contact-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contact/contact-api')>()
  return {
    ...actual,
    listAdminContactMessages: mocks.list,
    getAdminContactMessage: mocks.get,
    updateAdminContactMessageStatus: mocks.update,
  }
})

const messages = [
  {
    id: 'contact-1',
    userId: 'user-1',
    username: 'student1',
    fullName: 'Nguyễn Văn A',
    email: 'student1@uth.edu.vn',
    subject: 'Cần hỗ trợ tài khoản',
    content: 'Không thể đăng nhập.',
    status: 'NEW' as const,
    category: 'CONTACT' as const,
    createdAt: '2026-11-10T08:30:00.000Z',
    updatedAt: '2026-11-10T08:30:00.000Z',
  },
  {
    id: 'contact-2',
    userId: 'user-2',
    username: 'student2',
    fullName: 'Trần Thị B',
    email: 'student2@uth.edu.vn',
    subject: 'Lỗi ở bài tập',
    content: 'Ví dụ đầu ra chưa đúng.',
    status: 'IN_PROGRESS' as const,
    category: 'PROBLEM_REPORT' as const,
    problemCode: 'UTH101',
    problemTitle: 'Tổng hai số',
    createdAt: '2026-11-09T08:30:00.000Z',
    updatedAt: '2026-11-10T08:30:00.000Z',
  },
]

const statistics = { total: 42, NEW: 12, IN_PROGRESS: 9, RESOLVED: 21 }

function response(query: { page: number; pageSize: number }) {
  return {
    items: query.page === 1 ? messages : [{ ...messages[0], id: `contact-${query.page + 1}` }],
    total: 25,
    page: query.page,
    pageSize: query.pageSize,
    statistics,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>
}

let root: Root
let container: HTMLDivElement

async function settleUpdates(waitMs = 10) {
  await act(async () => new Promise((resolve) => setTimeout(resolve, waitMs)))
}

async function changeControl(control: HTMLInputElement | HTMLSelectElement, value: string, waitMs = 0) {
  await act(async () => {
    if (control instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, value)
    } else {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(control, value)
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  })
}

async function renderPage() {
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/admin/contact-messages']}>
          <LocationProbe />
          <Routes>
            <Route path="/admin/contact-messages" element={<AdminContactMessagesPage />} />
            <Route path="/admin/contact-messages/:messageId" element={<p data-testid="detail-route">Chi tiết yêu cầu</p>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await settleUpdates()
}

beforeEach(async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await i18n.changeLanguage('vi')
  mocks.list.mockImplementation((_request: unknown, query: { page: number; pageSize: number }) =>
    Promise.resolve(response(query)),
  )
  mocks.get.mockResolvedValue({
    ...messages[0],
    category: 'CONTACT',
    replies: [],
  })
  mocks.update.mockResolvedValue(messages[0])
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mocks.list.mockReset()
  mocks.get.mockReset()
  mocks.update.mockReset()
  mocks.request.mockReset()
  mocks.notice.mockReset()
})

describe('AdminContactMessagesPage', () => {
  it('shows backend statistics first and removes the old heading and system captions', async () => {
    await renderPage()

    const metrics = container.querySelector('[aria-label="Thống kê tin nhắn liên hệ"]')
    expect(metrics?.querySelectorAll('article')).toHaveLength(4)
    expect(metrics?.textContent).toContain('Tổng tin nhắn42')
    expect(metrics?.textContent).toContain('Tin nhắn mới12')
    expect(metrics?.textContent).toContain('Đang xử lý9')
    expect(metrics?.textContent).toContain('Đã xử lý21')
    expect(metrics?.textContent).not.toContain('Từ hệ thống')
    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).not.toContain('Quản lý liên hệ')
    expect(Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent)).toEqual([
      'STT',
      'NGƯỜI GỬI',
      'TIÊU ĐỀ',
      'NGÀY GỬI',
      'TRẠNG THÁI',
      'THAO TÁC',
    ])
    expect(mocks.list).toHaveBeenCalledWith(
      expect.any(Function),
      { page: 1, pageSize: 10, q: undefined, status: undefined, category: undefined },
      expect.any(AbortSignal),
    )
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('preserves search and filter parameters, resets them, and avoids duplicate filtered fetches', async () => {
    await renderPage()

    await changeControl(
      container.querySelector<HTMLInputElement>('[aria-label="Tìm theo tên, email, tiêu đề hoặc mã bài tập"]')!,
      'UTH101',
      280,
    )
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.any(Function),
      { page: 1, pageSize: 10, q: 'UTH101', status: undefined, category: undefined },
      expect.any(AbortSignal),
    )

    await changeControl(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo trạng thái"]')!, 'IN_PROGRESS', 270)
    await settleUpdates()
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo trạng thái"]')?.value).toBe('IN_PROGRESS')
    await changeControl(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo loại yêu cầu"]')!, 'PROBLEM_REPORT', 270)
    await settleUpdates()
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo loại yêu cầu"]')?.value).toBe('PROBLEM_REPORT')
    const filteredQuery = { page: 1, pageSize: 10, q: 'UTH101', status: 'IN_PROGRESS', category: 'PROBLEM_REPORT' }
    expect(mocks.list).toHaveBeenLastCalledWith(expect.any(Function), filteredQuery, expect.any(AbortSignal))
    expect(mocks.list.mock.calls.filter(([, query]) =>
      JSON.stringify(query) === JSON.stringify(filteredQuery),
    )).toHaveLength(1)

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Đặt lại'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.any(Function),
      { page: 1, pageSize: 10, q: undefined, status: undefined, category: undefined },
      expect.any(AbortSignal),
    )
    expect(container.querySelector<HTMLInputElement>('[aria-label="Tìm theo tên, email, tiêu đề hoặc mã bài tập"]')?.value).toBe('')
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo trạng thái"]')?.value).toBe('all')
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Lọc tin nhắn theo loại yêu cầu"]')?.value).toBe('all')
  })

  it('keeps top and bottom pagers synchronized and preserves list state when opening details', async () => {
    await renderPage()

    let pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].parentElement?.textContent).toContain('Hiển thị 1–10 trên 25 tin nhắn')
    expect(Array.from(container.querySelectorAll<HTMLSelectElement>('select')).map((select) => Array.from(select.options).map((option) => option.value)))
      .toContainEqual(['10', '20', '50'])
    await act(async () => {
      pagers[0].querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    pagers = container.querySelectorAll<HTMLElement>('nav')
    for (const pager of pagers) {
      expect(pager.querySelector('[aria-current="page"]')?.textContent).toBe('2')
      expect(pager.parentElement?.textContent).toContain('Hiển thị 11–20 trên 25 tin nhắn')
    }
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.any(Function),
      { page: 2, pageSize: 10, q: undefined, status: undefined, category: undefined },
      expect.any(AbortSignal),
    )

    const pageSize = Array.from(container.querySelectorAll<HTMLSelectElement>('select'))
      .find((select) => Array.from(select.options).some((option) => option.value === '20'))!
    await changeControl(pageSize, '20')
    await settleUpdates()
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.any(Function),
      { page: 1, pageSize: 20, q: undefined, status: undefined, category: undefined },
      expect.any(AbortSignal),
    )
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Xem chi tiết tin nhắn của Nguyễn Văn A"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[data-testid="detail-route"]')?.textContent).toBe('Chi tiết yêu cầu')
    const location = JSON.parse(container.querySelector('[data-testid="location"]')?.textContent ?? '{}')
    expect(location.pathname).toBe('/admin/contact-messages/contact-1')
    expect(location.state.listState).toEqual({
      search: '',
      statusFilter: 'all',
      categoryFilter: 'all',
      page: 1,
      pageSize: 20,
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('announces loading and error states, and renders the filtered empty state', async () => {
    mocks.list.mockImplementation(() => new Promise(() => {}))
    await renderPage()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Đang tải')
    await act(async () => root.unmount())
    root = createRoot(container)
    mocks.list.mockImplementation((_request: unknown, _query: { page: number; pageSize: number }) =>
      Promise.resolve({ ...response({ page: 1, pageSize: 10 }), items: [], total: 0 }),
    )
    await renderPage()
    expect(container.textContent).toContain('Chưa có tin nhắn liên hệ')

    await act(async () => root.unmount())
    root = createRoot(container)
    mocks.list.mockRejectedValueOnce(new Error('offline'))
    await renderPage()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('offline')
  })
})
