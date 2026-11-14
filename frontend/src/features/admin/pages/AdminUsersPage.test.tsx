// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import AdminUsersPage from './AdminUsersPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  setNotice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request, setNotice: mocks.setNotice }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-self' } }),
}))

const totalUsers = 45
const activeUsers = 39
const inactiveUsers = 6
const adminUsers = 3

function user(index: number) {
  if (index === 0) {
    return {
      id: 'admin-self',
      username: 'admin-self',
      email: 'admin@uth.edu.vn',
      fullName: 'Quản trị viên hiện tại',
      avatarUrl: null,
      role: 'ADMIN' as const,
      isActive: true,
      authMethods: ['password' as const],
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-12T08:00:00.000Z',
    }
  }
  return {
    id: `user-${index + 1}`,
    username: `student${index + 1}`,
    email: `student${index + 1}@uth.edu.vn`,
    fullName: `Người dùng ${index + 1}`,
    avatarUrl: null,
    role: index === 0 || index === 3 || index === 5 ? 'ADMIN' as const : 'STUDENT' as const,
    isActive: index < totalUsers - inactiveUsers,
    authMethods: ['password' as const],
    createdAt: `2026-10-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
    updatedAt: '2026-11-12T08:00:00.000Z',
  }
}

const allUsers = Array.from({ length: totalUsers }, (_, index) => user(index))

function listPageFor(path: string) {
  const query = new URLSearchParams(path.slice(path.indexOf('?') + 1))
  const requestedPage = Number(query.get('page') ?? 1)
  const requestedPageSize = Number(query.get('pageSize') ?? 20)
  let users = allUsers
  const search = query.get('search')?.toLowerCase()
  const role = query.get('role')
  const status = query.get('status')
  if (search) {
    users = users.filter((item) =>
      [item.username, item.email, item.fullName].some((value) => value?.toLowerCase().includes(search)),
    )
  }
  if (role) users = users.filter((item) => item.role === role)
  if (status) users = users.filter((item) => item.isActive === (status === 'active'))
  const offset = (requestedPage - 1) * requestedPageSize
  return {
    items: users.slice(offset, offset + requestedPageSize),
    total: users.length,
    page: requestedPage,
    pageSize: requestedPageSize,
  }
}

let root: Root
let container: HTMLDivElement
let failStats = false
let returnEmpty = false

async function settleUpdates(waitMs = 10) {
  await act(async () => new Promise((resolve) => setTimeout(resolve, waitMs)))
}

async function changeControl(
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
  waitMs = 0,
) {
  await act(async () => {
    if (control instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, value)
    } else {
      Array.from(control.options).forEach((option) => { option.selected = option.value === value })
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
        <MemoryRouter>
          <AdminUsersPage />
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
  failStats = false
  returnEmpty = false
  mocks.request.mockImplementation((path: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'PATCH') {
      const body = JSON.parse(options.body ?? '{}')
      return Promise.resolve({ ...allUsers[1], ...body })
    }
    if (failStats && path.includes('pageSize=1')) return Promise.reject(new Error('offline'))
    const result = listPageFor(path)
    return Promise.resolve(returnEmpty ? { ...result, items: [], total: 0 } : result)
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

describe('AdminUsersPage', () => {
  it('uses exact API totals for user, status, and admin metrics', async () => {
    await renderPage()

    const metrics = container.querySelector('[aria-label="Thống kê người dùng"]')
    expect(metrics?.querySelectorAll('article')).toHaveLength(4)
    expect(metrics?.textContent).toContain('Tổng người dùng')
    expect(metrics?.textContent).toContain(String(totalUsers))
    expect(metrics?.textContent).toContain('Đang hoạt động')
    expect(metrics?.textContent).toContain(String(activeUsers))
    expect(metrics?.textContent).toContain('Đã vô hiệu hóa')
    expect(metrics?.textContent).toContain(String(inactiveUsers))
    expect(metrics?.textContent).toContain('Quản trị viên')
    expect(metrics?.textContent).toContain(String(adminUsers))
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=1')
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=1&status=active')
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=1&status=inactive')
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=1&role=ADMIN')

    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).not.toContain('Quản lý người dùng')
    expect(Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent)).toEqual([
      'TÊN ĐĂNG NHẬP',
      'EMAIL',
      'HỌ VÀ TÊN',
      'VAI TRÒ',
      'TRẠNG THÁI',
      'NGÀY ĐĂNG KÝ',
      'THAO TÁC',
    ])
    expect(container.querySelector('[data-label="Tên đăng nhập"]')?.textContent).toContain('Bạn')
    const currentUserButtons = Array.from(container.querySelectorAll<HTMLTableRowElement>('tr'))
      .find((row) => row.textContent?.includes('admin-self'))
      ?.querySelectorAll('button')
    expect(currentUserButtons?.[1].disabled).toBe(true)
    expect(currentUserButtons?.[2].disabled).toBe(true)
  })

  it('keeps top and bottom pagers synchronized and honors the shared page sizes', async () => {
    await renderPage()

    let pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].parentElement?.textContent).toContain('Hiển thị 1–20 trên 45 người dùng')
    const pageSizeSelect = pagers[1].parentElement!.querySelector<HTMLSelectElement>('select')!
    expect(Array.from(pageSizeSelect.options).map((option) => option.value)).toEqual(['10', '20', '50'])

    await act(async () => {
      pagers[0].querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=2&pageSize=20')
    pagers = container.querySelectorAll<HTMLElement>('nav')
    for (const pager of pagers) {
      expect(pager.querySelector('[aria-current="page"]')?.textContent).toBe('2')
      expect(pager.parentElement?.textContent).toContain('Hiển thị 21–40 trên 45 người dùng')
    }

    await changeControl(pageSizeSelect, '50')
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=50')
    pagers = container.querySelectorAll<HTMLElement>('nav')
    for (const pager of pagers) {
      expect(pager.querySelector('[aria-current="page"]')?.textContent).toBe('1')
      expect(pager.parentElement?.textContent).toContain('Hiển thị 1–45 trên 45 người dùng')
    }
  })

  it('resets page when filters or debounced search change and clears filters', async () => {
    await renderPage()

    const pageSize = container.querySelectorAll<HTMLSelectElement>('select').item(2)!
    await changeControl(pageSize, '10')
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=2&pageSize=10')

    await changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Lọc theo vai trò"]')!, 'ADMIN')
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=10&role=ADMIN')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/users?page=1&pageSize=10&role=ADMIN')).toHaveLength(1)
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('1')

    await changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Lọc theo trạng thái tài khoản"]')!, 'inactive')
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=10&role=ADMIN&status=inactive')
    expect(mocks.request.mock.calls.filter(([path]) => path === '/admin/users?page=1&pageSize=10&role=ADMIN&status=inactive')).toHaveLength(1)

    await changeControl(
      container.querySelector<HTMLInputElement>('input[aria-label="Tìm theo tên đăng nhập, email hoặc họ tên"]')!,
      'student',
      370,
    )
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=10&search=student&role=ADMIN&status=inactive')
    expect(mocks.request.mock.calls.filter(([path]) =>
      path === '/admin/users?page=1&pageSize=10&search=student&role=ADMIN&status=inactive',
    )).toHaveLength(1)
    const beforeClear = mocks.request.mock.calls.length
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Xóa bộ lọc'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    expect(mocks.request).toHaveBeenCalledWith('/admin/users?page=1&pageSize=10')
    expect(mocks.request.mock.calls.length).toBeLessThanOrEqual(beforeClear + 1)
  })

  it('does not send a write request when opening or canceling an action confirmation', async () => {
    await renderPage()

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Cấp Admin'))
        ?.click()
    })
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Cấp quyền Admin?')
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
        .find((button) => button.textContent?.includes('Hủy'))
        ?.click()
    })
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)
  })

  it('keeps the existing role-change payload behind explicit confirmation', async () => {
    await renderPage()

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Cấp Admin'))
        ?.click()
    })
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
        .find((button) => button.textContent?.includes('Cấp quyền Admin'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.request).toHaveBeenCalledWith('/admin/users/user-2/role', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'ADMIN' }),
    })
    expect(mocks.setNotice).toHaveBeenCalledWith('Đã cấp quyền Admin cho “Người dùng 2”.')
  })

  it('keeps the existing status-change payload behind explicit confirmation', async () => {
    await renderPage()
    await changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Lọc theo trạng thái tài khoản"]')!, 'inactive')
    await settleUpdates()

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.includes('Kích hoạt'))
        ?.click()
    })
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Kích hoạt tài khoản?')
    expect(mocks.request.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false)

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
        .find((button) => button.textContent?.includes('Kích hoạt'))
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mocks.request).toHaveBeenCalledWith('/admin/users/user-40/status', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    })
  })

  it('shows empty results without pagination and surfaces statistics failures', async () => {
    returnEmpty = true
    await renderPage()
    expect(container.textContent).toContain('Chưa có người dùng nào')
    expect(container.querySelectorAll('nav')).toHaveLength(0)

    await act(async () => root.unmount())
    failStats = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await renderPage()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải thống kê người dùng.')
    expect(container.querySelector('[aria-label="Thống kê người dùng"]')?.textContent).toContain('—')
  })
})
