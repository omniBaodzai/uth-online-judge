import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { buildLoginPath } from '../return-path'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth')
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
          {t('authRetry')}
        </button>
      </main>
    )
  }

  return (
    <main aria-live="polite" className="auth-route-status">
      {isLoading ? '' : t('authRedirecting')}
    </main>
  )
}
