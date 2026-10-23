import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdmin } from '../useAdmin'
import { useAuth } from '../../auth/useAuth'
import { AdminIcon } from '../components/AdminIcons'
import uthLogo from '../../../assets/uth_logo.png'
import styles from '../admin.module.css'

const pageNames: Record<string, string> = {
  '/admin': 'Tổng quan',
  '/admin/problems': 'Quản lý bài tập',
  '/admin/users': 'Quản lý người dùng',
}

function AdminLayout() {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { notice, setNotice } = useAdmin()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const title = pathname.includes('/test-cases')
    ? 'Quản lý test case'
    : pathname.includes('/edit') || pathname.endsWith('/new')
      ? pathname.endsWith('/new') ? 'Tạo bài tập' : 'Chỉnh sửa bài tập'
      : pageNames[pathname] ?? 'Khu vực Admin'

  async function signOut() {
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } catch {
      setNotice('Không thể đăng xuất do lỗi kết nối. Vui lòng thử lại.')
    }
  }

  return (
    <div className={styles.adminShell}>
      <a className={styles.skipLink} href="#admin-main">Bỏ qua điều hướng</a>
      {sidebarOpen && <button className={styles.mobileScrim} aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`} aria-label="Điều hướng quản trị">
        <Link className={styles.brand} to="/admin" onClick={() => setSidebarOpen(false)}>
          <img className={styles.brandLogo} src={uthLogo} alt="Đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
        </Link>
        <nav className={styles.sideNav}>
          <NavLink to="/admin" end className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <AdminIcon name="grid" /><span>Tổng quan</span>
          </NavLink>
          <NavLink to="/admin/problems" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <AdminIcon name="book" /><span>Bài tập</span>
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <AdminIcon name="users" /><span>Người dùng</span>
          </NavLink>
        </nav>
        <div className={styles.sidebarFoot}>
          <Link to="/" className={styles.returnLink}><AdminIcon name="home" /> Trang học viên</Link>
        </div>
      </aside>

      <div className={styles.adminMain}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} type="button" aria-label="Mở menu điều hướng" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
            <AdminIcon name="menu" size={21} />
          </button>
          <div className={styles.breadcrumbs}><span>Admin</span><AdminIcon name="chevron" size={14} /><strong>{title}</strong></div>
          <div className={styles.profileWrap}>
            <button className={styles.profileButton} type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
              <span className={styles.avatar}>AD</span><span className={styles.profileText}><strong>{user?.full_name || user?.username || 'Quản trị viên'}</strong><small>{user?.email}</small></span>
              <AdminIcon name="chevron" size={14} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <p>Phiên quản trị đã được xác thực.</p>
                <button type="button" onClick={() => { setProfileOpen(false); void signOut() }}>Đăng xuất</button>
              </div>
            )}
          </div>
        </header>
        <main id="admin-main" className={styles.content}>
          <Outlet />
        </main>
      </div>
      {notice && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>{notice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><AdminIcon name="close" size={16} /></button>
        </div>
      )}
    </div>
  )
}

export default AdminLayout
