// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationLeaderboardPanel from './OrganizationLeaderboardPanel'
import { listOrganizationLeaderboard } from '../organizations-api'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.translate, i18n: { resolvedLanguage: 'en' } }),
}))

vi.mock('../useOrganizationsApi', () => ({
  useOrganizationsApi: () => mocks.api,
}))

vi.mock('../organizations-api', () => ({
  listOrganizationLeaderboard: vi.fn(),
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listOrganizationLeaderboard).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
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

async function renderPanel() {
  await act(async () => {
    root.render(<OrganizationLeaderboardPanel slug="navi website" />)
  })
}

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function clickButton(name: string) {
  const button = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  expect(button).toBeDefined()
  act(() => button?.click())
}

describe('OrganizationLeaderboardPanel', () => {
  it('shows a loading state while the leaderboard request is pending', async () => {
    vi.mocked(listOrganizationLeaderboard).mockReturnValue(new Promise(() => {}))
    await renderPanel()

    expect(container.textContent).toContain('organizationTabLoading')
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('renders only rank, member name, and solved count', async () => {
    vi.mocked(listOrganizationLeaderboard).mockResolvedValue({
      items: [{ rank: 1, userId: 'user-1', username: 'navi', solvedCount: 7 }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await renderPanel()
    await flushEffects()

    expect(container.textContent).toContain('navi')
    expect(container.textContent).toContain('7')
    expect(container.textContent).toContain('organizationLeaderboardRank')
    expect(container.textContent).not.toContain('points')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('shows an empty state when the leaderboard has no entries', async () => {
    await renderPanel()
    await flushEffects()

    expect(container.textContent).toContain('organizationLeaderboardEmpty')
  })

  it('shows an error with a retry action', async () => {
    vi.mocked(listOrganizationLeaderboard)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 10 })
    await renderPanel()
    await flushEffects()

    expect(container.textContent).toContain('organizationLeaderboardLoadError')
    clickButton('organizationsRetry')
    await flushEffects()
    expect(listOrganizationLeaderboard).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('organizationLeaderboardEmpty')
  })

  it('paginates through the API response', async () => {
    vi.mocked(listOrganizationLeaderboard)
      .mockResolvedValueOnce({
        items: [{ rank: 1, userId: 'user-1', username: 'first', solvedCount: 8 }],
        total: 11,
        page: 1,
        pageSize: 10,
      })
      .mockResolvedValueOnce({
        items: [{ rank: 11, userId: 'user-11', username: 'last', solvedCount: 1 }],
        total: 11,
        page: 2,
        pageSize: 10,
      })
    await renderPanel()
    await flushEffects()

    expect(container.textContent).toContain('first')
    clickButton('organizationLeaderboardNext')
    await flushEffects()

    expect(listOrganizationLeaderboard).toHaveBeenLastCalledWith(
      mocks.api,
      'navi website',
      { page: 2, pageSize: 10 },
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('last')
    expect(container.textContent).toContain('organizationLeaderboardPage')
  })
})
