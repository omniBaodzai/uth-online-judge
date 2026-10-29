import { useEffect, useState } from 'react'
import { ApiError } from '../auth/api'
import { fetchProblemDetail } from './api'
import { toProblemDetail, type ProblemDetail } from './detail-data'
import { useProblemsFetcher } from './useProblemsFetcher'

export type ProblemDetailState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; problem: ProblemDetail }

export function useProblemDetail(code: string): { state: ProblemDetailState; retry: () => void } {
  const { fetcher, ready } = useProblemsFetcher()
  const [state, setState] = useState<ProblemDetailState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setState({ phase: 'loading' })
    fetchProblemDetail(fetcher, code)
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', problem: toProblemDetail(data) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) setState({ phase: 'not-found' })
        else {
          setState({
            phase: 'error',
            message: error instanceof ApiError ? error.message : 'Không thể tải bài tập. Vui lòng thử lại.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, code, reloadKey])

  return { state, retry: () => setReloadKey((key) => key + 1) }
}
