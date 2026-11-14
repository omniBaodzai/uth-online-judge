// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContributorsResponse } from './api'
import { useContributorsData } from './useContributorsData'

const mocks = vi.hoisted(() => ({
  publicRequest: vi.fn(),
  authenticatedRequest: vi.fn(),
  accessToken: null as string | null,
}))

vi.mock('../auth/api', () => ({
  request: mocks.publicRequest,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ accessToken: mocks.accessToken, request: mocks.authenticatedRequest }),
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
  total: 1,
  totalContributors: 1,
  page: 1,
  pageSize: 20,
}

let root: Root
let container: HTMLDivElement

function Harness({ page = 1, pageSize = 20, q }: { page?: number; pageSize?: number; q?: string }) {
  const state = useContributorsData({ page, pageSize, q })
  return <output>{JSON.stringify(state)}</output>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.accessToken = null
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('useContributorsData', () => {
  it('reports loading and loads the public API response', async () => {
    let resolveRequest!: (value: ContributorsResponse) => void
    mocks.publicRequest.mockReturnValue(
      new Promise<ContributorsResponse>((resolve) => {
        resolveRequest = resolve
      }),
    )

    await act(async () => root.render(<Harness page={2} pageSize={5} q="admin" />))
    expect(JSON.parse(container.textContent ?? '{}')).toMatchObject({ data: null, loading: true, error: false })

    await act(async () => resolveRequest(response))
    expect(mocks.publicRequest).toHaveBeenCalledWith('/contributors?page=2&pageSize=5&q=admin')
    expect(JSON.parse(container.textContent ?? '{}')).toMatchObject({ data: response, loading: false, error: false })
  })

  it('uses the authenticated requester when an access token exists', async () => {
    mocks.accessToken = 'test-token'
    mocks.authenticatedRequest.mockResolvedValue(response)

    await act(async () => root.render(<Harness />))

    expect(mocks.authenticatedRequest).toHaveBeenCalledWith('/contributors?page=1&pageSize=20')
    expect(mocks.publicRequest).not.toHaveBeenCalled()
    expect(JSON.parse(container.textContent ?? '{}')).toMatchObject({ data: response, loading: false })
  })

  it('surfaces request failures as an error state', async () => {
    mocks.publicRequest.mockRejectedValue(new Error('network failure'))

    await act(async () => root.render(<Harness />))

    expect(JSON.parse(container.textContent ?? '{}')).toMatchObject({ data: null, loading: false, error: true })
  })
})
