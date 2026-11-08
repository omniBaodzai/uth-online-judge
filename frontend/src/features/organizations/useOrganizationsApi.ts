import { useCallback } from 'react'
import { request as publicRequest } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import type { ApiRequest } from './organizations-api'

// Auth `request` ném 401 khi chưa đăng nhập, nên khách dùng request công khai.
export function useOrganizationsApi(): ApiRequest {
  const { accessToken, request } = useAuth()
  return useCallback(
    <T,>(path: string, init?: RequestInit) =>
      accessToken ? request<T>(path, init) : publicRequest<T>(path, init),
    [accessToken, request],
  )
}
