import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import styles from '../admin.module.css'

export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { user, isLoading, initializationError, retrySession } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <main className={styles.routeMessage} aria-live="polite">Đang kiểm tra quyền quản trị…</main>
  }
  if (initializationError) {
    return (
      <main className={styles.routeMessage} role="alert">
        <p>{initializationError}</p>
        <button className={styles.buttonSecondary} type="button" onClick={() => void retrySession()}>Thử lại</button>
      </main>
    )
  }
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/admin/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }
  if (user.role !== 'ADMIN') {
    return (
      <main className={styles.routeMessage} role="alert">
        <h1>Không có quyền quản trị</h1>
        <p>Tài khoản hiện tại không có vai trò Admin. Hãy dùng tài khoản quản trị được cấp quyền.</p>
        <Link className={styles.buttonSecondary} to="/">Quay lại trang học viên</Link>
      </main>
    )
  }
  return children ?? <Outlet />
}
