import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../auth/api'

type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiError | Error }

// Tải dữ liệu và bỏ qua phản hồi cũ khi tham số đổi nhanh hoặc component đã unmount.
export function useAsync<T>(
  load: (() => Promise<T>) | null,
  deps: unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!load) return
    let cancelled = false
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading', data: null, error: null }))
    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: error instanceof Error ? error : new Error('Lỗi không xác định') })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  return { ...state, reload }
}

export function errorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
