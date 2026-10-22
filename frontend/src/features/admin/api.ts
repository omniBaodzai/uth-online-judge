import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

export function useAdminQuery<T>(path: string) {
  const { request } = useAuth()
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key: '', data: null, error: '' })
  const [version, setVersion] = useState(0)
  const key = `${path}#${version}`

  useEffect(() => {
    let cancelled = false
    request<T>(path)
      .then((result) => {
        if (!cancelled) setState({ key, data: result, error: '' })
      })
      .catch((reason: unknown) => {
        if (!cancelled) setState((current) => ({ key, data: current.data, error: reason instanceof Error ? reason.message : 'Không tải được dữ liệu.' }))
      })
    return () => {
      cancelled = true
    }
  }, [path, request, key])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { data: state.data, error: state.error, loading: state.key !== key, reload }
}

export function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN')
}

export function describeError(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Đã xảy ra lỗi.'
}
