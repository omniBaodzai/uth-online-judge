import { useEffect, useState } from 'react'
import { ApiError } from '../auth/api'
import { fetchBestSubmissions, type BestSubmissionsResponse } from './api'
import { useProblemsFetcher } from './useProblemsFetcher'

export type BestSubmissionsState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: BestSubmissionsResponse }

export function useBestSubmissions(code: string, page: number, pageSize: number) {
  const { fetcher, ready } = useProblemsFetcher()
  const [state, setState] = useState<BestSubmissionsState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setState({ phase: 'loading' })
    fetchBestSubmissions(fetcher, code, page, pageSize)
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) setState({ phase: 'not-found' })
        else {
          setState({
            phase: 'error',
            message: error instanceof ApiError ? error.message : 'Không thể tải bài nộp tốt nhất. Vui lòng thử lại.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, code, page, pageSize, reloadKey])

  return { state, retry: () => setReloadKey((key) => key + 1) }
}
