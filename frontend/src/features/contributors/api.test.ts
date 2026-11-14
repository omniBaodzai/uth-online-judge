import { describe, expect, it, vi } from 'vitest'
import { fetchContributors, type ContributorsResponse } from './api'

describe('fetchContributors', () => {
  it('requests the paginated contributors endpoint with a trimmed username search', async () => {
    const response: ContributorsResponse = {
      items: [],
      total: 0,
      totalContributors: 0,
      page: 2,
      pageSize: 5,
    }
    const requester = vi.fn().mockResolvedValue(response)

    await expect(fetchContributors(requester, { page: 2, pageSize: 5, q: '  admin  ' })).resolves.toBe(response)

    expect(requester).toHaveBeenCalledWith('/contributors?page=2&pageSize=5&q=admin')
  })

  it('omits empty search values', async () => {
    const requester = vi.fn().mockResolvedValue({ items: [] })
    await fetchContributors(requester, { page: 1, pageSize: 20, q: '   ' })
    expect(requester).toHaveBeenCalledWith('/contributors?page=1&pageSize=20')
  })
})
