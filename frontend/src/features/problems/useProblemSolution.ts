import { useEffect, useState } from 'react'
import { ApiError } from '../auth/api'
import { fetchProblemSolution, type ProblemSolutionResponse } from './api'
import { useProblemsFetcher } from './useProblemsFetcher'

export type ProblemSolutionState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: ProblemSolutionResponse }

export function useProblemSolution(code: string): { state: ProblemSolutionState; retry: () => void } {
  const { fetcher, ready } = useProblemsFetcher()
  const [state, setState] = useState<ProblemSolutionState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setState({ phase: 'loading' })
    fetchProblemSolution(fetcher, code)
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', data })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) setState({ phase: 'not-found' })
        else {
          setState({
            phase: 'error',
            message: error instanceof ApiError ? error.message : 'Không thể tải lời giải. Vui lòng thử lại.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, code, reloadKey])

  return { state, retry: () => setReloadKey((key) => key + 1) }
}
