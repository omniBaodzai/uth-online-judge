import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../auth/useAuth'
import { anonymousFetcher, type Fetcher } from './api'

// Chờ phiên đăng nhập khôi phục xong để trạng thái cá nhân (đã làm/chưa đúng) được tải đúng một lần.
// `fetcher` chỉ đổi khi người dùng đăng nhập/đăng xuất, không đổi khi token được làm mới.
export function useProblemsFetcher(): { fetcher: Fetcher; ready: boolean } {
  const { user, isLoading, request } = useAuth()
  const requestRef = useRef(request)
  useEffect(() => {
    requestRef.current = request
  }, [request])

  const isSignedIn = Boolean(user)
  const fetcher = useCallback<Fetcher>(
    (path, init) => (isSignedIn ? requestRef.current(path, init) : anonymousFetcher(path, init)),
    [isSignedIn],
  )
  return { fetcher, ready: !isLoading }
}
