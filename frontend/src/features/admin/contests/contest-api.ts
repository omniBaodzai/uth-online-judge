import type { AdminProblemPage } from '../types'
import type {
  ContestDetail,
  ContestInput,
  ContestListQuery,
  ContestOverview,
  ContestPage,
  ContestProblem,
  ReplaceContestProblemInput,
} from './types'

export type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>

export function createContestApi(request: AdminRequest) {
  return {
    list: (query: ContestListQuery) => {
      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
      })
      if (query.search) params.set('search', query.search)
      if (query.publicationStatus) params.set('publicationStatus', query.publicationStatus)
      if (query.timeStatus) params.set('timeStatus', query.timeStatus)
      return request<ContestPage>(`/admin/contests?${params.toString()}`)
    },
    overview: () => request<ContestOverview>('/admin/contests/overview'),
    get: (id: string) => request<ContestDetail>(`/admin/contests/${encodeURIComponent(id)}`),
    create: (input: ContestInput) => request<ContestDetail>('/admin/contests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    update: (id: string, input: ContestInput) => request<ContestDetail>(
      `/admin/contests/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
    replaceProblems: (id: string, problems: ReplaceContestProblemInput[]) => request<ContestProblem[]>(
      `/admin/contests/${encodeURIComponent(id)}/problems`,
      { method: 'PUT', body: JSON.stringify({ problems }) },
    ),
    publish: (id: string) => request<ContestDetail>(
      `/admin/contests/${encodeURIComponent(id)}/publish`,
      { method: 'POST' },
    ),
    archive: (id: string) => request<ContestDetail>(
      `/admin/contests/${encodeURIComponent(id)}/archive`,
      { method: 'POST' },
    ),
    restore: (id: string) => request<ContestDetail>(
      `/admin/contests/${encodeURIComponent(id)}/restore`,
      { method: 'POST' },
    ),
    listProblems: (search: string) => {
      const params = new URLSearchParams({ page: '1', pageSize: '100', status: 'published' })
      if (search.trim()) params.set('search', search.trim())
      return request<AdminProblemPage>(`/admin/problems?${params.toString()}`)
    },
  }
}

export type ContestApi = ReturnType<typeof createContestApi>
