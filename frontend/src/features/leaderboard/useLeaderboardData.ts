import { useEffect, useState } from 'react'
import { request as publicRequest } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { fetchLeaderboard, type LeaderboardParams, type LeaderboardResponse } from './api'

export function useLeaderboardData(params: LeaderboardParams) {
  const { accessToken, request } = useAuth()
  const { page, pageSize, q } = params
  const requestKey = JSON.stringify([Boolean(accessToken), page, pageSize, q ?? ''])
  const [state, setState] = useState<{
    key: string
    data: LeaderboardResponse | null
    error: string
  } | null>(null)

  useEffect(() => {
    let active = true
    void fetchLeaderboard(accessToken ? request : publicRequest, { page, pageSize, q })
      .then((response) => {
        if (active) setState({ key: requestKey, data: response, error: '' })
      })
      .catch(() => {
        if (active) setState({ key: requestKey, data: null, error: 'Không thể tải bảng xếp hạng. Vui lòng thử lại.' })
      })
    return () => { active = false }
  }, [accessToken, page, pageSize, q, request, requestKey])

  const current = state?.key === requestKey
  return {
    data: current ? state.data : null,
    loading: !current,
    error: current ? state.error : '',
  }
}