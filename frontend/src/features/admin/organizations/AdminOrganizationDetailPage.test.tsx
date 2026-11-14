// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import type { AdminOrganizationDetail } from '../../organizations/organizations-api'
import AdminOrganizationDetailPage from './AdminOrganizationDetailPage'

const mocks = vi.hoisted(() => ({
  api: vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(),
}))

vi.mock('../../organizations/useOrganizationsApi', () => ({
  useOrganizationsApi: () => mocks.api,
}))

const activeOrganization: AdminOrganizationDetail = {
  id: 'organization-1',
  slug: 'uth-coding',
  name: 'UTH Coding Club',
  description: 'Cộng đồng lập trình của trường.',
  websiteUrl: 'https://example.edu.vn',
  status: 'ACTIVE',
  problemsVisibility: 'PUBLIC',
  contestsVisibility: 'PRIVATE',
  submissionsVisibility: 'PRIVATE',
  archivedAt: null,
  createdAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-11-12T08:00:00.000Z',
  memberCount: 1,
  owner: { id: 'owner-1', username: 'owner', fullName: 'Chủ sở hữu', avatarUrl: null },
  archivedBy: null,
  sourceRequestId: 'request-1',
}

const member = {
  id: 'owner-1',
  username: 'owner',
  fullName: 'Chủ sở hữu',
  avatarUrl: null,
  role: 'OWNER' as const,
  joinedAt: '2026-10-12T08:00:00.000Z',
}

let root: Root
let container: HTMLDivElement
let organization: AdminOrganizationDetail
let detailError = false
let holdDetail = false
let resolveDetail: ((value: unknown) => void) | null = null
let clipboardWrite: ReturnType<typeof vi.fn>

beforeEach(async () => {
  await i18n.changeLanguage('vi')
  organization = { ...activeOrganization }
  detailError = false
  holdDetail = false
  resolveDetail = null
  clipboardWrite = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })

  mocks.api.mockReset()
  mocks.api.mockImplementation((path: string, _init?: RequestInit) => {
    const url = new URL(path, 'http://localhost')
    if (url.pathname === '/admin/organizations/organization-1') {
      if (detailError) return Promise.reject(new Error('offline'))
      if (holdDetail) {
        return new Promise((resolve) => { resolveDetail = resolve })
      }
      return Promise.resolve(organization)
    }
    if (url.pathname === '/admin/organizations/organization-1/archive'
      || url.pathname === '/admin/organizations/organization-1/restore') {
      return Promise.resolve(organization)
    }
    if (url.pathname.endsWith('/members')) {
      const items = organization.memberCount === 0 ? [] : [member]
      return Promise.resolve({ items, total: items.length, page: 1, pageSize: 10 })
    }
    if (url.pathname.endsWith('/problems')) {
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 })
    }
    if (url.pathname.endsWith('/contests/problem-options')) return Promise.resolve([])
    if (url.pathname.endsWith('/contests')) {
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 50 })
    }
    return Promise.reject(new Error(`Unexpected API request: ${path}`))
  })

  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mocks.api.mockReset()
})

async function renderPage() {
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/admin/organizations/organization-1']}>
          <Routes>
            <Route path="/admin/organizations/:id" element={<AdminOrganizationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function settleUpdates(waitMs = 20) {
  await act(async () => new Promise((resolve) => setTimeout(resolve, waitMs)))
}

function button(name: string) {
  const found = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  expect(found).toBeDefined()
  return found!
}

describe('AdminOrganizationDetailPage', () => {
  it('renders organization data and sections without the specified header and guidance text', async () => {
    await renderPage()
    await settleUpdates()

    expect(container.querySelector('h1')?.textContent).toBe('Thông tin tổ chức')
    expect(container.textContent).toContain('UTH Coding Club')
    expect(container.textContent).toContain('Chủ sở hữu')
    expect(container.textContent).toContain('Quản lý thành viên')
    expect(container.textContent).toContain('Bài tập')
    expect(container.textContent).toContain('Kỳ thi')
    expect(container.querySelector('tbody tr')?.textContent).toContain('Chủ sở hữu')
    expect(container.textContent).not.toContain('Danh sách tổ chức')
    expect(container.textContent).not.toContain('Chi tiết tổ chức dành cho Quản trị viên hệ thống')
    expect(container.textContent).not.toContain('Đang hoạt động')
    expect(container.textContent).not.toContain('Thay đổi OWNER thực hiện')
    expect(container.textContent).not.toContain('Bài tập, test case và quyền sử dụng chéo')
    expect(container.textContent).not.toContain('Hệ thống chưa liên kết bài tập với tổ chức này.')
    expect(container.textContent).not.toContain('Kỳ thi dùng bài tập Global')
    expect(container.textContent).not.toContain('Hệ thống chưa liên kết kỳ thi với tổ chức này.')
    expect(container.textContent).toContain('0 kết quả')
    expect(container.textContent).toContain('Thêm thành viên')
    expect(container.textContent).toContain('Tìm kiếm và bộ lọc')
    expect(container.textContent).toContain('Danh sách thành viên')
    expect(button('Tạo bài tập')).toBeTruthy()
    expect(button('Tạo kỳ thi')).toBeTruthy()
    expect(container.textContent).toContain('Chủ sở hữu')

    const organizationLink = [...container.querySelectorAll('a')]
      .find((link) => link.textContent?.includes('Trang tổ chức'))
    expect(organizationLink?.getAttribute('href')).toBe('/organizations/uth-coding')

    await act(async () => {
      button('Sao chép').click()
      await Promise.resolve()
    })
    expect(clipboardWrite).toHaveBeenCalledWith(
      new URL('/organizations/uth-coding', window.location.origin).toString(),
    )
    expect(container.textContent).toContain('Đã sao chép đường dẫn.')
  })

  it('shows a member count of zero instead of a missing-value marker', async () => {
    organization = { ...activeOrganization, memberCount: 0 }
    await renderPage()
    await settleUpdates()

    const countLabel = [...container.querySelectorAll('dt')]
      .find((label) => label.textContent === 'Số thành viên')
    expect(countLabel?.nextElementSibling?.textContent).toBe('0')
  })

  it('keeps the existing management actions and dialogs available', async () => {
    await renderPage()
    await settleUpdates()

    await act(async () => button('Chỉnh sửa').click())
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Chỉnh sửa — UTH Coding Club')
    const editName = container.querySelector<HTMLInputElement>('#edit-org-name')
    expect(document.activeElement).toBe(editName)
    await act(async () => {
      editName?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(button('Chỉnh sửa'))

    await act(async () => button('Đổi / gỡ OWNER').click())
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Đổi OWNER — UTH Coding Club')
    await act(async () => button('Hủy').click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    await act(async () => button('Lưu trữ').click())
    expect(mocks.api).toHaveBeenCalledWith('/admin/organizations/organization-1/archive', { method: 'POST' })
  })

  it('preserves archived history, disabled controls and restore action without a header badge', async () => {
    organization = {
      ...activeOrganization,
      status: 'ARCHIVED',
      archivedAt: '2026-11-12T08:00:00.000Z',
      archivedBy: { id: 'admin-1', username: 'admin', fullName: 'Admin', avatarUrl: null },
    }
    await renderPage()
    await settleUpdates()

    expect(container.textContent).toContain('Lịch sử lưu trữ')
    expect(container.textContent).toContain('Tổ chức đã được lưu trữ')
    expect(button('Chỉnh sửa').disabled).toBe(true)
    expect(button('Đổi / gỡ OWNER').disabled).toBe(true)
    expect(button('Khôi phục').disabled).toBe(false)
    expect(container.textContent).not.toContain('Đã lưu trữ')

    await act(async () => button('Khôi phục').click())
    expect(mocks.api).toHaveBeenCalledWith('/admin/organizations/organization-1/restore', { method: 'POST' })
  })

  it('keeps loading and recoverable error states', async () => {
    holdDetail = true
    await renderPage()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Đang tải chi tiết tổ chức')
    expect(resolveDetail).toBeTypeOf('function')
    await act(async () => resolveDetail?.(organization))
    await settleUpdates()
    expect(container.textContent).toContain('Thông tin tổ chức')

    await act(async () => root.unmount())
    holdDetail = false
    detailError = true
    root = createRoot(container)
    await renderPage()
    await settleUpdates()
    expect(container.textContent).toContain('Không thể tải tổ chức')
    expect(button('Thử lại')).toBeTruthy()
  })
})
