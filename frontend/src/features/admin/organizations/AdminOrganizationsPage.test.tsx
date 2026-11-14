// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import AdminOrganizationsPage from './AdminOrganizationsPage'

const mocks = vi.hoisted(() => ({
  api: vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(),
}))

vi.mock('../../organizations/useOrganizationsApi', () => ({
  useOrganizationsApi: () => mocks.api,
}))

const requestStatistics = { total: 35, PENDING: 21, APPROVED: 9, REJECTED: 5 }

const organization = {
  id: 'organization-1',
  slug: 'uth-coding',
  name: 'UTH Coding Club',
  description: null,
  websiteUrl: null,
  status: 'ACTIVE' as const,
  problemsVisibility: 'PUBLIC' as const,
  contestsVisibility: 'PUBLIC' as const,
  submissionsVisibility: 'PRIVATE' as const,
  archivedAt: null,
  createdAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-11-12T08:00:00.000Z',
  memberCount: 18,
  owner: { id: 'owner-1', username: 'owner', fullName: 'Chủ sở hữu', avatarUrl: null },
  archivedBy: null,
}

const requestItem = {
  id: 'request-1',
  fullName: 'Nguyễn Văn A',
  workplace: 'UTH',
  position: 'Giảng viên',
  phoneNumber: '0901234567',
  motivation: 'Tạo cộng đồng lập trình.',
  status: 'PENDING' as const,
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-10-10T08:00:00.000Z',
  updatedAt: '2026-10-10T08:00:00.000Z',
  createdOrganization: null,
  requester: { id: 'requester-1', username: 'student', fullName: 'Nguyễn Văn A', avatarUrl: null, email: 'student@uth.edu.vn' },
  reviewer: null,
  createdOrganizationDetails: null,
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
      Array.from(control.options).forEach((option) => { option.selected = option.value === value })
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  })
}

async function renderPage(initialEntry = '/admin/organizations') {
  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AdminOrganizationsPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await settleUpdates()
}

function callsFor(pathname: string) {
  return mocks.api.mock.calls
    .map(([path, init]) => ({ url: new URL(path, 'http://localhost'), init }))
    .filter(({ url }) => url.pathname === pathname)
}

beforeEach(async () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await i18n.changeLanguage('vi')
  mocks.api.mockImplementation((path: string, init?: RequestInit) => {
    const url = new URL(path, 'http://localhost')
    if (url.pathname === '/admin/organizations') {
      const method = init?.method ?? 'GET'
      if (method !== 'GET') return Promise.resolve(organization)
      const page = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
      const status = url.searchParams.get('status')
      const total = status === 'ACTIVE' ? 12 : status === 'ARCHIVED' ? 4 : 16
      return Promise.resolve({
        items: page === 1 ? [organization] : [{ ...organization, id: `organization-${page}`, name: `Organization ${page}` }],
        total,
        page,
        pageSize,
      })
    }
    if (url.pathname === '/admin/organization-requests') {
      const method = init?.method ?? 'GET'
      if (method !== 'GET') return Promise.resolve(requestItem)
      const page = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
      const total = url.searchParams.get('status') === 'PENDING' ? 21 : requestStatistics.total
      return Promise.resolve({ items: [requestItem], total, page, pageSize, statistics: requestStatistics })
    }
    return Promise.reject(new Error(`Unexpected API request: ${path}`))
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  mocks.api.mockReset()
})

describe('AdminOrganizationsPage', () => {
  it('shows exact organization and pending-request statistics without the old heading', async () => {
    await renderPage()

    const metrics = container.querySelector('[aria-label="Thống kê tổ chức"]')
    expect(metrics?.querySelectorAll('article')).toHaveLength(4)
    expect(metrics?.textContent).toContain('Tổng tổ chức16')
    expect(metrics?.textContent).toContain('Đang hoạt động12')
    expect(metrics?.textContent).toContain('Đã lưu trữ4')
    expect(metrics?.textContent).toContain('Yêu cầu chờ duyệt21')
    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).not.toContain('Quản lý tổ chức')
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Danh sách tổ chức')
    const organizationCalls = callsFor('/admin/organizations')
    const statisticsCalls = organizationCalls.filter(({ url }) => url.searchParams.get('pageSize') === '1')
    expect(organizationCalls).toHaveLength(4)
    expect(statisticsCalls.map(({ url }) => url.searchParams.get('status'))).toEqual(
      expect.arrayContaining([null, 'ACTIVE', 'ARCHIVED']),
    )
    expect(organizationCalls.some(({ url }) => url.searchParams.get('pageSize') === '10')).toBe(true)
    expect(callsFor('/admin/organization-requests')).toHaveLength(1)
    expect(callsFor('/admin/organization-requests')[0].url.searchParams.get('pageSize')).toBe('1')
  })

  it('keeps both tab states mounted and uses synchronized shared pagination', async () => {
    await renderPage()

    let pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].parentElement?.textContent).toContain('Hiển thị 1–10 trên 16 tổ chức')
    await act(async () => {
      pagers[0].querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(2)
    expect(pagers[0].querySelector('[aria-current="page"]')?.textContent).toBe('2')
    expect(pagers[1].querySelector('[aria-current="page"]')?.textContent).toBe('2')
    expect(callsFor('/admin/organizations').some(({ url }) =>
      url.searchParams.get('page') === '2' && url.searchParams.get('pageSize') === '10',
    )).toBe(true)

    const pageSizeSelect = Array.from(container.querySelectorAll<HTMLSelectElement>('select'))
      .find((select) => Array.from(select.options).some((option) => option.value === '20'))
    expect(pageSizeSelect).toBeTruthy()
    await changeControl(pageSizeSelect!, '20')
    await settleUpdates()
    expect(callsFor('/admin/organizations').some(({ url }) =>
      url.searchParams.get('page') === '1' && url.searchParams.get('pageSize') === '20',
    )).toBe(true)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="requests-panel"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    pagers = container.querySelectorAll<HTMLElement>('nav')
    expect(pagers).toHaveLength(4)
    expect(pagers[2].parentElement?.textContent).toContain('Hiển thị 1–10 trên 21 yêu cầu')
    await act(async () => {
      pagers[2].querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    const requestPanel = container.querySelector<HTMLElement>('#requests-panel')!
    const requestPagers = requestPanel.querySelectorAll<HTMLElement>('nav')
    expect(requestPagers[0].querySelector('[aria-current="page"]')?.textContent).toBe('2')
    expect(requestPagers[1].querySelector('[aria-current="page"]')?.textContent).toBe('2')
    const requestPageSize = requestPanel.querySelector<HTMLSelectElement>('label select')!
    await changeControl(requestPageSize, '20')
    await settleUpdates()
    expect(callsFor('/admin/organization-requests').some(({ url }) =>
      url.searchParams.get('page') === '1' && url.searchParams.get('pageSize') === '20' && url.searchParams.get('status') === 'PENDING',
    )).toBe(true)
    await changeControl(
      requestPanel.querySelector<HTMLSelectElement>('[aria-label="Lọc theo trạng thái yêu cầu"]')!,
      'APPROVED',
    )
    await settleUpdates()
    expect(callsFor('/admin/organization-requests').some(({ url }) =>
      url.searchParams.get('status') === 'APPROVED' && url.searchParams.get('page') === '1',
    )).toBe(true)
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="organizations-panel"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(requestPanel.querySelector<HTMLSelectElement>('[aria-label="Lọc theo trạng thái yêu cầu"]')?.value).toBe('APPROVED')
    expect(callsFor('/admin/organization-requests').filter(({ init }) => (init?.method ?? 'GET') !== 'GET')).toHaveLength(0)
  })

  it('debounces request search and does not issue writes while changing tabs or opening the OWNER dialog', async () => {
    await renderPage()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="requests-panel"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    await changeControl(container.querySelector<HTMLInputElement>('[aria-label="Tìm yêu cầu"]')!, 'coding', 350)
    expect(callsFor('/admin/organization-requests').some(({ url }) => url.searchParams.get('q') === 'coding')).toBe(true)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="requests-panel"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    })
    expect(container.querySelector('[role="tab"][aria-controls="organizations-panel"]')?.getAttribute('aria-selected')).toBe('true')
    await settleUpdates()
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Đổi OWNER')
        ?.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Đổi OWNER')
    expect(callsFor('/admin/organizations').filter(({ init }) => (init?.method ?? 'GET') !== 'GET')).toHaveLength(0)
    expect(callsFor('/admin/organization-requests').filter(({ init }) => (init?.method ?? 'GET') !== 'GET')).toHaveLength(0)

    await changeControl(container.querySelector<HTMLInputElement>('#owner-identifier')!, 'new-owner')
    await act(async () => {
      container.querySelector<HTMLFormElement>('[role="dialog"] form')?.requestSubmit()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settleUpdates()
    const ownerUpdate = mocks.api.mock.calls.find(([path, init]) =>
      path === '/admin/organizations/organization-1/owner' && init?.method === 'PATCH',
    )
    expect(ownerUpdate).toBeTruthy()
    if (!ownerUpdate) throw new Error('Expected OWNER update request')
    expect(JSON.parse((ownerUpdate[1] as RequestInit).body as string)).toEqual({ ownerIdentifier: 'new-owner' })
  })
})
