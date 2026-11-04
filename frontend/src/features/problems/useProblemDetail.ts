import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../auth/api'
import { fetchProblemDetail } from './api'
import { toProblemDetail, type ProblemDetail } from './detail-data'
import { useProblemsFetcher } from './useProblemsFetcher'
import './i18n'

export type ProblemDetailState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; problem: ProblemDetail }

export function useProblemDetail(
  code: string,
  enabled = true,
): { state: ProblemDetailState; retry: () => void } {
  const { t } = useTranslation('pages')
  const { fetcher, ready } = useProblemsFetcher()
  const [result, setResult] = useState<{ key: string; state: ProblemDetailState }>()
  const [reloadKey, setReloadKey] = useState(0)
  const key = JSON.stringify([code, reloadKey])
  const state = result?.key === key ? result.state : { phase: 'loading' as const }

  useEffect(() => {
    if (!ready || !enabled) return
    let cancelled = false
    fetchProblemDetail(fetcher, code)
      .then((data) => {
        if (!cancelled) setResult({ key, state: { phase: 'ready', problem: toProblemDetail(data) } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) {
          setResult({ key, state: { phase: 'not-found' } })
        }
        else {
          setResult({
            key,
            state: {
              phase: 'error',
              message: error instanceof ApiError ? error.message : t('problemCannotLoad'),
            },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, enabled, code, key, t])

  return { state, retry: () => setReloadKey((key) => key + 1) }
}
