import { useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen, Database, FileCode2, LayoutDashboard, LifeBuoy, LogOut, Menu, Settings, ShieldCheck, TriangleAlert, Users,
  type LucideIcon,
} from 'lucide-react'
import uthLogo from '../../assets/uth_logo.png'
import { useAuth } from '../auth/useAuth'
import styles from './admin.module.css'

const links: { to: string; label: string; icon: LucideIcon; end?: boolean; admin: boolean }[] = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true, admin: true },
  { to: '/admin/users', label: 'Người dùng', icon: Users, admin: true },
  { to: '/admin/problems', label: 'Bài tập', icon: BookOpen, admin: true },
  { to: '/admin/submissions', label: 'Bài nộp', icon: FileCode2, admin: true },
  { to: '/admin/moderation', label: 'Kiểm duyệt', icon: ShieldCheck, admin: false },
  { to: '/admin/data', label: 'Dữ liệu & sao lưu', icon: Database, admin: true },
  { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: Settings, admin: true },
  { to: '/admin/logs', label: 'Nhật ký lỗi', icon: TriangleAlert, admin: true },
  { to: '/admin/support', label: 'Hỗ trợ', icon: LifeBuoy, admin: false },
]

function AdminGate({ children, adminOnly }: { children: ReactNode; adminOnly: boolean }) {
  const { user } = useAuth()
  const role = user?.role
  const allowed = adminOnly ? role === 'ADMIN' : role === 'ADMIN' || role === 'MODERATOR'
  if (allowed) return children
  return (
    <div className={styles.denied} role="alert">
      <h2>Không đủ quyền truy cập</h2>
      <p>{adminOnly ? 'Khu vực này chỉ dành cho quản trị viên.' : 'Khu vực này dành cho quản trị viên và điều hành viên.'}</p>
      <Link className={styles.btn} to="/admin">Về trang quản trị</Link>
    </div>
  )
}

function Shell({ title, subtitle, adminOnly, children }: { title: string; subtitle?: string; adminOnly: boolean; children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Lưu đường dẫn đang mở menu để menu tự đóng khi chuyển trang.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === location.pathname
  const isAdmin = user?.role === 'ADMIN'
  const name = user?.username ?? user?.email ?? ''

  return (
    <div className={styles.layout}>
      <header className={styles.topbar}>
        <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls="admin-sidebar" aria-label="Mở menu quản trị" onClick={() => setOpenPath(open ? null : location.pathname)}>
          <Menu size={20} aria-hidden="true" />
        </button>
        <img src={uthLogo} alt="UTH" />
        <strong>Quản trị</strong>
      </header>
      {open && <div className={styles.overlay} onClick={() => setOpenPath(null)} aria-hidden="true" />}
      <aside id="admin-sidebar" className={`${styles.adminSidebar} ${open ? styles.sidebarOpen : ''}`}>
        <Link to="/admin" className={styles.logo} aria-label="UTH Online Judge - Quản trị">
          <img src={uthLogo} alt="Trường đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
        </Link>
        <nav aria-label="Menu quản trị" className={styles.nav}>
          {links
            .filter((link) => isAdmin || !link.admin)
            .map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.active}` : styles.navLink)}>
                <link.icon className={styles.navIcon} size={18} strokeWidth={2} aria-hidden="true" />
                {link.label}
              </NavLink>
            ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span><b>{name}</b><small>{user?.role === 'ADMIN' ? 'Quản trị viên' : 'Điều hành viên'}</small></span>
          </div>
          <button type="button" className={styles.footerLink} onClick={() => void logout().then(() => navigate('/admin/login'))}><LogOut size={16} aria-hidden="true" />Đăng xuất</button>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          <AdminGate adminOnly={adminOnly}>{children}</AdminGate>
        </div>
      </main>
    </div>
  )
}

function AdminSession({ children }: { children: ReactNode }) {
  const { user, isLoading, initializationError, retrySession } = useAuth()
  const location = useLocation()

  if (user && (user.role === 'ADMIN' || user.role === 'MODERATOR')) return children
  if (isLoading) return <main className={styles.status} aria-live="polite">Đang kiểm tra phiên đăng nhập…</main>
  if (initializationError) {
    return (
      <main className={styles.status} role="alert">
        <p>{initializationError}</p>
        <button type="button" className={styles.btn} onClick={() => void retrySession()}>Thử lại</button>
      </main>
    )
  }
  // Chưa đăng nhập, hoặc đang đăng nhập bằng tài khoản thường ở trang chính: yêu cầu đăng nhập quản trị riêng.
  return <Navigate to={`/admin/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
}

export default function AdminLayout({ title, subtitle, adminOnly = true, children }: { title: string; subtitle?: string; adminOnly?: boolean; children: ReactNode }) {
  return (
    <AdminSession>
      <Shell title={title} subtitle={subtitle} adminOnly={adminOnly}>{children}</Shell>
    </AdminSession>
  )
}
