// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContributorsResponse } from '../../contributors/api'
import HomePage from './HomePage'

const mocks = vi.hoisted(() => ({
  useContributorsData: vi.fn(),
  useLeaderboardData: vi.fn(),
}))

vi.mock('../../contributors/useContributorsData', () => ({
  useContributorsData: mocks.useContributorsData,
}))

vi.mock('../../leaderboard/useLeaderboardData', () => ({
  useLeaderboardData: mocks.useLeaderboardData,
}))

vi.mock('../components/HeroBanner', () => ({ default: () => <div data-testid="hero" /> }))
vi.mock('../components/CommunityFeed', () => ({ default: () => <div data-testid="feed" /> }))
vi.mock('../components/LeaderboardCard', () => ({
  default: ({ id, people, href, loading, error }: { id: string; people: Array<{ name: string; score: number }>; href?: string; loading?: boolean; error?: string }) => (
    <section data-testid={id} data-href={href} data-loading={String(Boolean(loading))} data-error={error ?? ''}>
      {people.map((person) => (
        <span key={person.name}>
          {person.name}:{person.score}
        </span>
      ))}
    </section>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function contributor(index: number) {
  return {
    userId: `admin-${index}`,
    username: `admin_${index}`,
    displayName: `Admin ${index}`,
    avatarUrl: null,
    contributionCount: 10 - index,
    latestContributionAt: `2026-11-${String(index).padStart(2, '0')}T10:00:00.000000Z`,
    rank: index,
  }
}

const response: ContributorsResponse = {
  items: Array.from({ length: 6 }, (_, index) => contributor(index + 1)),
  total: 6,
  totalContributors: 6,
  page: 1,
  pageSize: 5,
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useContributorsData.mockReturnValue({ data: response, loading: false, error: false })
  mocks.useLeaderboardData.mockReturnValue({ data: null, loading: false, error: '' })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('HomePage contributors card', () => {
  it('uses the contributors API hook for the top five and links to the full page', async () => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      ),
    )

    expect(mocks.useContributorsData).toHaveBeenCalledWith({ page: 1, pageSize: 5 })
    const card = container.querySelector<HTMLElement>('[data-testid="contributors"]')
    expect(card?.dataset.href).toBe('/contributors')
    expect(card?.textContent).toContain('Admin 1:9')
    expect(card?.textContent).toContain('Admin 5:5')
    expect(card?.textContent).not.toContain('Admin 6')
  })

  it('passes loading and error state through to the existing card', async () => {
    mocks.useContributorsData.mockReturnValue({ data: null, loading: false, error: true })
    await act(async () =>
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      ),
    )
    const card = container.querySelector<HTMLElement>('[data-testid="contributors"]')
    expect(card?.dataset.error).toBe('contributorsLoadError')
    expect(card?.textContent).toBe('')
  })
})
