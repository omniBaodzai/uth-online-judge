// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeaderboardResponse } from '../api'
import LeaderboardPage from './LeaderboardPage'

const mocks = vi.hoisted(() => ({
  useLeaderboardData: vi.fn(),
}))

vi.mock('../useLeaderboardData', () => ({
  useLeaderboardData: mocks.useLeaderboardData,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'vi', language: 'vi' },
  }),
}))

const response: LeaderboardResponse = {
  items: [
    {
      userId: 'admin-1',
      username: 'lebao',
      displayName: 'Admin',
      avatarUrl: null,
      solvedCount: 8,
      cumulativePoints: 293,
      performancePercentile: 0,
      comparableProblems: 1,
      achievementAt: null,
      rank: 1,
    },
  ],
  total: 1,
  totalUsers: 1,
  page: 1,
  pageSize: 20,
  viewerRank: null,
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useLeaderboardData.mockReturnValue({
    data: response,
    loading: false,
    error: '',
  })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('LeaderboardPage', () => {
  it('shows coder identity and ranking metrics without the comparison performance detail', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <LeaderboardPage />
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Admin')
    expect(container.textContent).toContain('@lebao')
    expect(container.textContent).toContain('293')
    expect(container.textContent).toContain('8')
    expect(container.textContent).toContain('1')
    expect(container.textContent).not.toContain('Top 1%')
    expect(container.textContent).not.toContain('bài so sánh')
  })
})
