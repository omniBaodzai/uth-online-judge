import { useEffect, useState } from 'react'
import { request as publicRequest } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { fetchContributors, type ContributorsParams, type ContributorsResponse } from './api'

export function useContributorsData(params: ContributorsParams) {
  const { accessToken, request } = useAuth()
  const { page, pageSize, q } = params
  const requestKey = JSON.stringify([Boolean(accessToken), page, pageSize, q ?? ''])
  const [state, setState] = useState<{
    key: string
    data: ContributorsResponse | null
    error: boolean
  } | null>(null)

  useEffect(() => {
    let active = true
    void fetchContributors(accessToken ? request : publicRequest, { page, pageSize, q })
      .then((response) => {
        if (active) setState({ key: requestKey, data: response, error: false })
      })
      .catch(() => {
        if (active) setState({ key: requestKey, data: null, error: true })
      })
    return () => {
      active = false
    }
  }, [accessToken, page, pageSize, q, request, requestKey])

  const current = state?.key === requestKey
  return {
    data: current ? state.data : null,
    loading: !current,
    error: current ? state.error : false,
  }
}
