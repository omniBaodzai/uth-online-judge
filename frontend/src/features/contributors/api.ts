export type ContributorEntry = {
  userId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  contributionCount: number
  latestContributionAt: string | null
  rank: number
}

export type ContributorsResponse = {
  items: ContributorEntry[]
  total: number
  totalContributors: number
  page: number
  pageSize: number
}

export type ContributorsParams = {
  page: number
  pageSize: number
  q?: string
}

export type ContributorsRequester = <T>(path: string, init?: RequestInit) => Promise<T>

export function buildContributorsQuery(params: ContributorsParams): string {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.q?.trim()) query.set('q', params.q.trim())
  return `?${query.toString()}`
}

export function fetchContributors(requester: ContributorsRequester, params: ContributorsParams) {
  return requester<ContributorsResponse>(`/contributors${buildContributorsQuery(params)}`)
}
