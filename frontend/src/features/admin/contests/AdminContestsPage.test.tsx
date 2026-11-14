// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n'
import AdminContestsPage from './AdminContestsPage'

const mocks = vi.hoisted(() => ({
  api: {
    list: vi.fn(),
    overview: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
  setNotice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ setNotice: mocks.setNotice }),
}))

vi.mock('./useContestAdmin', () => ({
  useContestAdmin: () => mocks.api,
}))

const contest = {
  id: 'contest-1',
  slug: 'uth-cup',
  title: 'UTH Cup',
  description: null,
  rules: null,
  startsAt: '2026-11-12T08:00:00.000Z',
  endsAt: '2026-11-12T10:00:00.000Z',
  publicationStatus: 'PUBLISHED',
  visibility: 'PUBLIC',
  allowRegistration: true,
  showLeaderboard: true,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-01T08:00:00.000Z',
  publishedAt: '2026-11-01T08:00:00.000Z',
  timeStatus: 'ONGOING',
  problemCount: 1,
  participantCount: 4,
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.api.list.mockResolvedValue({ items: [contest], total: 1, page: 1, pageSize: 10 })
  mocks.api.overview.mockResolvedValue({
    total: 8,
    draft: 1,
    published: 5,
    archived: 2,
    upcoming: 0,
    ongoing: 0,
    ended: 2,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('AdminContestsPage', () => {
  it('shows live statistics first, the create action next, and preserves table pagination', async () => {
    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <AdminContestsPage />
          </MemoryRouter>
        </I18nextProvider>,
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      expect(Array.from(card.children).map((child) => child.tagName)).toEqual(['SPAN', 'P', 'STRONG'])
    }
    expect(container.textContent).toContain('Tổng cuộc thi')
    expect(container.textContent).toContain('Đang diễn ra')
    expect(container.textContent).toContain('Sắp diễn ra')
    expect(container.textContent).toContain('Đã kết thúc')
    expect(Array.from(cards).map((card) => card.querySelector('strong')?.textContent)).toEqual([
      '8',
      '0',
      '0',
      '2',
    ])
    expect(container.querySelectorAll('article svg')).toHaveLength(4)

    expect(container.textContent).not.toContain('QUẢN LÝ NỘI DUNG')
    expect(container.textContent).not.toContain('Quản lý cuộc thi')
    expect(container.textContent).not.toContain('Theo dõi lịch tổ chức')
    expect(container.textContent).not.toContain('Dữ liệu cuộc thi và thay đổi')
    expect(container.textContent).not.toContain('Từ dữ liệu cuộc thi')
    expect(container.textContent).not.toContain('cuộc thi phù hợp')

    const createLink = container.querySelector<HTMLAnchorElement>('a[href="/admin/contests/new"]')
    expect(createLink?.textContent).toContain('Tạo cuộc thi')
    expect(
      cards[0]!.parentElement!.compareDocumentPosition(createLink!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent)).toEqual([
      'TÊN CUỘC THI',
      'BẮT ĐẦU',
      'KẾT THÚC',
      'THÀNH VIÊN',
      'TRẠNG THÁI',
      'THAO TÁC',
    ])
    expect(container.querySelectorAll('nav')).toHaveLength(2)
    expect(container.textContent).toContain('Hiển thị')
    expect(container.textContent).toContain('UTH Cup')
  })
})
