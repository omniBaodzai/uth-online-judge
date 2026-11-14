// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminOrganizationRequest } from '../../organizations/organizations-api'
import AdminOrganizationRequestDetailPage from './AdminOrganizationRequestDetailPage'
import styles from './AdminOrganizationRequestDetailPage.module.css'

const mocks = vi.hoisted(() => ({
  api: vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(),
}))

vi.mock('../../organizations/useOrganizationsApi', () => ({
  useOrganizationsApi: () => mocks.api,
}))

const pendingRequest: AdminOrganizationRequest = {
  id: 'request-1',
  fullName: 'Nguyễn Văn A',
  workplace: 'UTH',
  position: 'Giảng viên',
  phoneNumber: '0901234567',
  motivation: 'Mong muốn xây dựng một cộng đồng lập trình tại trường.',
  status: 'PENDING',
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
  createdOrganization: null,
  requester: {
    id: 'requester-1',
    username: 'student',
    fullName: 'Nguyễn Văn A',
    avatarUrl: null,
    email: 'student@uth.edu.vn',
  },
  reviewer: null,
  createdOrganizationDetails: null,
}

const approvedRequest: AdminOrganizationRequest = {
  ...pendingRequest,
  status: 'APPROVED',
  reviewNote: 'Đã phê duyệt.',
  reviewedAt: '2026-10-12T08:00:00.000Z',
  createdOrganization: {
    id: 'organization-1',
    slug: 'uth-coding-club',
    name: 'UTH Coding Club',
  },
  reviewer: {
    id: 'reviewer-1',
    username: 'admin',
    fullName: 'Quản trị viên',
    avatarUrl: null,
  },
  createdOrganizationDetails: {
    id: 'organization-1',
    slug: 'uth-coding-club',
    name: 'UTH Coding Club',
    status: 'ACTIVE',
    owner: {
      id: 'owner-1',
      username: 'owner',
      fullName: 'Chủ sở hữu',
      avatarUrl: null,
    },
  },
}

let root: Root
let container: HTMLDivElement
let request: AdminOrganizationRequest
let clipboardWrite: ReturnType<typeof vi.fn>
let resolveRequest: ((value: unknown) => void) | null
let holdRequest: boolean

beforeEach(() => {
  request = { ...pendingRequest }
  resolveRequest = null
  holdRequest = false
  clipboardWrite = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWrite },
  })
  mocks.api.mockReset()
  mocks.api.mockImplementation((path: string) => {
    if (path !== '/admin/organization-requests/request-1') {
      return Promise.reject(new Error(`Unexpected API request: ${path}`))
    }
    if (holdRequest) {
      return new Promise((resolve) => { resolveRequest = resolve })
    }
    return Promise.resolve(request)
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
      <MemoryRouter initialEntries={['/admin/organization-requests/request-1']}>
        <Routes>
          <Route path="/admin/organization-requests/:id" element={<AdminOrganizationRequestDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function settleUpdates(waitMs = 10) {
  await act(async () => new Promise((resolve) => setTimeout(resolve, waitMs)))
}

function button(name: string) {
  const found = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  expect(found).toBeDefined()
  return found!
}

function fieldValue(label: string) {
  const term = [...container.querySelectorAll('dt')]
    .find((candidate) => candidate.textContent === label)
  return term?.nextElementSibling?.textContent
}

describe('AdminOrganizationRequestDetailPage', () => {
  it('shows sender details and pending review controls without the removed header content', async () => {
    await renderPage()

    expect(container.querySelector(`.${styles.page}`)).not.toBeNull()
    expect(container.textContent).toContain('Thông tin người gửi')
    expect(container.textContent).toContain('student@uth.edu.vn')
    expect(container.textContent).toContain('Mong muốn xây dựng một cộng đồng lập trình tại trường.')
    expect(container.textContent).not.toContain('Danh sách yêu cầu')
    expect(container.textContent).not.toContain('Chi tiết yêu cầu tạo tổ chức')
    expect(container.textContent).not.toContain('Yêu cầu từ')
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector(`.${styles.pendingBadge}`)?.textContent).toBe('Chờ xử lý')
    expect(button('Duyệt yêu cầu')).toBeTruthy()
    expect(button('Từ chối yêu cầu')).toBeTruthy()
    expect(mocks.api).toHaveBeenCalledWith('/admin/organization-requests/request-1', expect.anything())
  })

  it('shows approved organization data, links, owner and status in their cards', async () => {
    request = approvedRequest
    await renderPage()

    expect(container.querySelector(`.${styles.approvedBadge}`)?.textContent).toBe('Đã chấp thuận')
    expect(container.textContent).toContain('Xét duyệt')
    expect(container.textContent).toContain('Tổ chức đã tạo')
    expect(fieldValue('Tên tổ chức')).toBe('UTH Coding Club')
    expect(fieldValue('Slug')).toBe('uth-coding-club')
    expect(fieldValue('OWNER')).toBe('owner')
    expect(container.textContent).toContain('Đang hoạt động')
    expect(container.querySelectorAll(`.${styles.requestLinkRow}`)).toHaveLength(3)
    expect(container.querySelector(`.${styles.actions}`)).toBeNull()
  })

  it('shows archived organization state and a missing OWNER without losing the approved request state', async () => {
    request = {
      ...approvedRequest,
      createdOrganizationDetails: {
        id: 'organization-1',
        slug: 'uth-coding-club',
        name: 'UTH Coding Club',
        status: 'ARCHIVED',
        owner: null,
      },
    }
    await renderPage()

    expect(container.querySelector(`.${styles.approvedBadge}`)?.textContent).toBe('Đã chấp thuận')
    expect(container.querySelector(`.${styles.archivedBadge}`)?.textContent).toBe('Đã lưu trữ')
    expect(fieldValue('OWNER')).toBe('Chưa có OWNER')
  })

  it('uses the rejection reason and badge for rejected requests', async () => {
    request = { ...pendingRequest, status: 'REJECTED', reviewNote: 'Thiếu thông tin bổ sung.' }
    await renderPage()

    expect(container.querySelector(`.${styles.rejectedBadge}`)?.textContent).toBe('Đã từ chối')
    expect(fieldValue('Lý do từ chối')).toBe('Thiếu thông tin bổ sung.')
    expect(container.textContent).not.toContain('Duyệt yêu cầu')
    expect(container.textContent).not.toContain('Từ chối yêu cầu')
  })

  it('keeps missing requester and organization data readable', async () => {
    request = {
      ...approvedRequest,
      requester: null,
      reviewer: null,
      createdOrganizationDetails: null,
    }
    await renderPage()

    expect(container.textContent).toContain('Tài khoản không còn tồn tại')
    expect(fieldValue('Email')).toBe('—')
    expect(fieldValue('Người xét duyệt')).toBe('—')
    expect(container.textContent).toContain('Máy chủ chưa trả về thông tin tổ chức đã tạo.')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('disables copy buttons while copying and announces success', async () => {
    let finishCopy: (() => void) | null = null
    clipboardWrite.mockImplementation(() => new Promise<void>((resolve) => { finishCopy = resolve }))
    request = approvedRequest
    await renderPage()

    await act(async () => button('Sao chép').click())
    expect(button('Đang sao chép…').disabled).toBe(true)
    expect(container.querySelectorAll(`.${styles.copyButton}:disabled`)).toHaveLength(3)
    await act(async () => {
      finishCopy?.()
      await Promise.resolve()
    })

    expect(clipboardWrite).toHaveBeenCalledWith(
      new URL('/organizations/uth-coding-club', window.location.origin).toString(),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Đã sao chép đường dẫn.')
    expect(button('Đã sao chép').disabled).toBe(false)
  })

  it('announces clipboard failures with a recovery message', async () => {
    clipboardWrite.mockRejectedValue(new Error('clipboard unavailable'))
    request = approvedRequest
    await renderPage()

    await act(async () => {
      button('Sao chép').click()
      await Promise.resolve()
    })

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Không thể sao chép. Hãy chọn và sao chép liên kết thủ công.',
    )
    expect(button('Sao chép').disabled).toBe(false)
  })

  it('shows loading and recoverable request errors', async () => {
    holdRequest = true
    await renderPage()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Đang tải chi tiết yêu cầu')
    expect(resolveRequest).toBeTypeOf('function')

    await act(async () => resolveRequest?.(request))
    await settleUpdates()
    expect(container.textContent).toContain('Thông tin người gửi')

    await act(async () => root.unmount())
    mocks.api.mockReset()
    mocks.api.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(request)
    root = createRoot(container)
    await renderPage()
    expect(container.textContent).toContain('Không thể tải yêu cầu')
    expect(button('Thử lại')).toBeTruthy()

    await act(async () => button('Thử lại').click())
    await settleUpdates()
    expect(container.textContent).toContain('Thông tin người gửi')
    expect(mocks.api).toHaveBeenCalledTimes(2)
  })
})
