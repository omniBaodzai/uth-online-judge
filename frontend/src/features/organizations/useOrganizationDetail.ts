import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { getOrganization, getOrganizationManage, type OrganizationDetail } from './organizations-api'
import { useOrganizationsApi } from './useOrganizationsApi'

export type OrganizationDetailState =
  | { status: 'loading' }
  | { status: 'ready'; organization: OrganizationDetail }
  | { status: 'notFound' | 'forbidden' | 'unauthorized' | 'error' }

export function stateFromError(caught: unknown): OrganizationDetailState {
  if (caught instanceof ApiError) {
    if (caught.status === 404) return { status: 'notFound' }
    if (caught.status === 403) return { status: 'forbidden' }
    if (caught.status === 401) return { status: 'unauthorized' }
  }
  return { status: 'error' }
}

// Chờ phiên đăng nhập khôi phục xong để không gọi API ẩn danh rồi lại gọi lại với token.
export function useOrganizationDetail(slug: string, mode: 'public' | 'manage') {
  const api = useOrganizationsApi()
  const { isLoading: authLoading } = useAuth()
  const [state, setState] = useState<OrganizationDetailState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController()
    setState({ status: 'loading' })
    const load = mode === 'manage' ? getOrganizationManage : getOrganization
    load(api, slug, controller.signal)
      .then((organization) => setState({ status: 'ready', organization }))
      .catch((caught) => {
        if (!controller.signal.aborted) setState(stateFromError(caught))
      })
    return () => controller.abort()
  }, [api, authLoading, mode, slug, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])
  const replace = useCallback(
    (organization: OrganizationDetail) => setState({ status: 'ready', organization }),
    [],
  )
  return { state: authLoading ? ({ status: 'loading' } as const) : state, reload, replace }
}
