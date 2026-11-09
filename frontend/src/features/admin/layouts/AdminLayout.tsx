import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdmin } from '../useAdmin'
import { useAuth } from '../../auth/useAuth'
import { AdminIcon } from '../components/AdminIcons'
import { Building2, Mail, Trophy } from 'lucide-react'
import Breadcrumb from '../../../components/navigation/Breadcrumb'
import uthLogo from '../../../assets/uth_logo.png'
import styles from '../admin.module.css'

const FOCUSABLE = 'a[href], button:not([disabled])'

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { notice, setNotice } = useAdmin()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const wasSidebarOpen = useRef(false)

  useEffect(() => {
    if (sidebarOpen) {
      sidebarRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    } else if (wasSidebarOpen.current) {
      menuButtonRef.current?.focus()
    }
    wasSidebarOpen.current = sidebarOpen
  }, [sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen && !profileOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false)
        } else {
          setProfileOpen(false)
          profileButtonRef.current?.focus()
        }
        return
      }
      if (event.key !== 'Tab' || !sidebarOpen || !sidebarRef.current) return
      const items = sidebarRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!sidebarRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen, profileOpen])

  async function signOut() {
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } catch {
      setNotice('Không thể đăng xuất do lỗi kết nối. Vui lòng thử lại.')
    }
  }

  return (
    <div className={styles.adminShell} data-admin-theme="light">
      <a className={styles.skipLink} href="#admin-main">Bỏ qua điều hướng, đến nội dung chính</a>
      {sidebarOpen && <button className={styles.mobileScrim} type="button" aria-label="Đóng menu" tabIndex={-1} onClick={() => setSidebarOpen(false)} />}
      <aside id="admin-sidebar" ref={sidebarRef} className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`} aria-label="Điều hướng quản trị">
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
          <NavLink to="/admin/contests" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <Trophy size={18} aria-hidden="true" /><span>Cuộc thi</span>
          </NavLink>
          <NavLink to="/admin/news" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <AdminIcon name="news" /><span>Tin tức</span>
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <AdminIcon name="users" /><span>Người dùng</span>
          </NavLink>
          <NavLink to="/admin/organizations" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <Building2 size={18} aria-hidden="true" /><span>Tổ chức</span>
          </NavLink>
          <NavLink to="/admin/contact-messages" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`} onClick={() => setSidebarOpen(false)}>
            <Mail size={18} aria-hidden="true" /><span>Liên hệ</span>
          </NavLink>
        </nav>
        <div className={styles.sidebarFoot}>
          <Link to="/" className={styles.returnLink}><AdminIcon name="home" /> Trang học viên</Link>
        </div>
      </aside>

      <div className={styles.adminMain}>
        <header className={styles.topbar}>
          <button ref={menuButtonRef} className={styles.mobileMenu} type="button" aria-label="Mở menu điều hướng" aria-expanded={sidebarOpen} aria-controls="admin-sidebar" onClick={() => setSidebarOpen(true)}>
            <AdminIcon name="menu" size={21} />
          </button>
          <Breadcrumb />
          <div className={styles.profileWrap}>
            <button ref={profileButtonRef} className={styles.profileButton} type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
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
