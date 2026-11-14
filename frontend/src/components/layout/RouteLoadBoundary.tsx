import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { FullscreenLoader } from '../ui/Loading'
import styles from './RouteLoadBoundary.module.css'

type RouteErrorBoundaryProps = {
  children: ReactNode
  errorMessage: string
  retryLabel: string
}

type RouteErrorBoundaryState = {
  hasError: boolean
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Failed to load route content', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.state} role="alert">
          <p>{this.props.errorMessage}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {this.props.retryLabel}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function RouteLoadBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <RouteErrorBoundary key={pathname} errorMessage={t('pageLoadError')} retryLabel={t('retry')}>
      <Suspense
        fallback={(
          <FullscreenLoader label={t('loading')} />
        )}
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  )
}

export default RouteLoadBoundary
