import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'
import FloatingActions from '../floating/FloatingActions'
import styles from './AppLayout.module.css'

function AppLayout() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Bỏ qua điều hướng, đến nội dung chính
      </a>
      <SiteHeader />
      <div className={styles.content}>
        <Outlet />
      </div>
      <SiteFooter />
      <FloatingActions />
    </div>
  )
}

export default AppLayout
