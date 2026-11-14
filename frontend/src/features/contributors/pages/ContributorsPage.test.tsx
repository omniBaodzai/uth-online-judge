// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContributorsResponse } from '../api'
import ContributorsPage from './ContributorsPage'

const mocks = vi.hoisted(() => ({
  useContributorsData: vi.fn(),
}))

vi.mock('../useContributorsData', () => ({
  useContributorsData: mocks.useContributorsData,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { page?: number; count?: number }) => {
      if (key === 'pageNumber') return `Page ${options?.page}`
      if (key === 'contributorsTotalSummary') return `${options?.count} contributors`
      if (key === 'latestContributionHeading') return 'LATEST CONTRIBUTION'
      return key
    },
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}))

const response: ContributorsResponse = {
  items: [
    {
      userId: 'admin-1',
      username: 'admin_one',
      displayName: 'Admin One',
      avatarUrl: null,
      contributionCount: 3,
      latestContributionAt: '2026-11-13T10:14:15.123456Z',
      rank: 1,
    },
  ],
  total: 40,
  totalContributors: 40,
  page: 1,
  pageSize: 20,
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  mocks.useContributorsData.mockReturnValue({ data: response, loading: false, error: false })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ContributorsPage />
      </MemoryRouter>,
    ),
  )
}

describe('ContributorsPage', () => {
  it('renders the live contributor metrics without the synthetic points column', async () => {
    await render()

    expect(mocks.useContributorsData).toHaveBeenCalledWith({ page: 1, pageSize: 20, q: '' })
    expect(container.textContent).toContain('Admin One')
    expect(container.textContent).toContain('@admin_one')
    expect(container.textContent).toContain('LATEST CONTRIBUTION')
    expect(container.textContent).not.toContain('POINTS')
  })

  it.each([
    [{ data: null, loading: true, error: false }, 'loadingLeaderboard'],
    [{ data: null, loading: false, error: true }, 'contributorsLoadError'],
    [{ data: { ...response, items: [], total: 0 }, loading: false, error: false }, 'noCoders'],
  ])('renders the appropriate %s state', async (state, expectedText) => {
    mocks.useContributorsData.mockReturnValue(state)
    await render()
    expect(container.textContent).toContain(expectedText)
  })

  it('passes search and pagination changes to the API hook', async () => {
    vi.useFakeTimers()
    mocks.useContributorsData.mockImplementation(({ q }: { q?: string }) => ({
      data: q ? { ...response, items: [], total: 0 } : response,
      loading: false,
      error: false,
    }))
    await render()

    const pageTwo = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.getAttribute('aria-label') === 'Page 2')
    expect(pageTwo).not.toBeUndefined()
    await act(async () => pageTwo?.click())
    expect(mocks.useContributorsData).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, q: '' })

    const input = container.querySelector<HTMLInputElement>('input[type="search"]')
    expect(input).not.toBeNull()
    if (!input) throw new Error('Contributor search input was not rendered.')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(input, 'admin')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(mocks.useContributorsData).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, q: 'admin' })
    expect(container.textContent).toContain('noMatchingCoders')
  })
})
