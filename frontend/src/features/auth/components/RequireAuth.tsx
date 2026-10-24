import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { buildLoginPath } from '../return-path'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, initializationError, retrySession } = useAuth()
  const location = useLocation()
  const shouldRedirect = !isLoading && !user && !initializationError

  if (user) return children

  if (shouldRedirect) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={buildLoginPath(returnTo)} replace />
  }

  if (!isLoading && initializationError) {
    return (
      <main role="alert" className="auth-route-status">
        <p>{initializationError}</p>
        <button type="button" onClick={() => void retrySession()}>
          Thử lại
        </button>
      </main>
    )
  }

  return (
    <main aria-live="polite" className="auth-route-status">
      {isLoading ? 'Đang kiểm tra phiên đăng nhập…' : 'Đang chuyển đến trang đăng nhập…'}
    </main>
  )
}
