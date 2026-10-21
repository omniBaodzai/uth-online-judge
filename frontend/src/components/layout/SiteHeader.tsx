import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import styles from './SiteHeader.module.css'
import uthLogo from '../../assets/uth_logo.png'
import { useAuth } from '../../features/auth/useAuth'

const navigationLinks = [
  { label: 'Bài tập', href: '/problems' },
  { label: 'Bảng chấm bài', href: '/submissions' },
  { label: 'Bảng xếp hạng', href: '#leaderboard' },
  { label: 'Cuộc thi', href: '/contests' },
  { label: 'Tổ chức', href: '/organizations' },
  { label: 'Báo lỗi', href: 'mailto:huynhlebaoes@gmail.com?subject=Bao%20loi%20UTH%20Online%20Judge' },
  { label: 'Liên hệ', href: '#contact' },
]

function SiteHeader() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const { user, isLoading: isRestoringSession, initializationError, retrySession, logout } = useAuth()

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } catch {
      setLogoutError('Không thể thu hồi phiên trên máy chủ. Vui lòng thử đăng xuất lại.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    if (!accountMenuOpen) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
        accountButtonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!accountMenuOpen) return
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [accountMenuOpen])

  return (
    <header className={styles.header}>
      <Link className={styles.brand} to="/" aria-label="UTH Online Judge - Trang chủ">
        <img src={uthLogo} alt="Trường đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
      </Link>

      <div
        className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
        id="primary-navigation-panel"
      >
        <nav className={styles.navigation} aria-label="Điều hướng chính">
          <ul className={styles.navigationList}>
            {navigationLinks.map(({ label, href }) => (
              <li key={label}>
                {href.startsWith('/') ? (
                  <NavLink
                    className={styles.navigationLink}
                    to={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ) : (
                  <a
                    className={styles.navigationLink}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.accountActions} aria-busy={isRestoringSession && !user}>
          {isRestoringSession && !user ? (
            <div className={styles.accountSkeleton} role="status" aria-label="Đang kiểm tra phiên đăng nhập">
              <span />
              <span />
            </div>
          ) : user ? (
            <>
              <div className={styles.accountMenu} ref={accountMenuRef}>
                <button
                  className={styles.accountButton}
                  type="button"
                  ref={accountButtonRef}
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-menu"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className={styles.userGreeting}>Xin chào, {user.username ?? user.email}</span>
                  <span className={styles.accountChevron} aria-hidden="true">⌄</span>
                </button>
                {accountMenuOpen && (
                  <div className={styles.accountDropdown} id="account-menu" role="menu">
                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        setMenuOpen(false)
                      }}
                    >
                      Thông tin cá nhân
                    </Link>
                    <Link
                      to="/profile/edit"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        setMenuOpen(false)
                      }}
                    >
                      Chỉnh sửa hồ sơ
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                    </button>
                  </div>
                )}
              </div>
              {initializationError && (
                <div className={styles.sessionWarning} role="status">
                  <span>Không thể xác nhận phiên với máy chủ.</span>
                  <button type="button" onClick={() => void retrySession()}>Thử lại</button>
                </div>
              )}
            </>
          ) : initializationError ? (
            <div className={styles.sessionError}>
              <span role="status">Chưa thể kiểm tra phiên đăng nhập.</span>
              <button type="button" onClick={() => void retrySession()}>Thử lại</button>
            </div>
          ) : (
            <>
              <Link className={styles.registerLink} to="/register" onClick={() => setMenuOpen(false)}>
                Đăng ký
              </Link>
              <Link className={styles.loginLink} to="/login" onClick={() => setMenuOpen(false)}>
                Đăng nhập
              </Link>
            </>
          )}
        </div>
        {logoutError && <p className={styles.logoutError} role="alert">{logoutError}</p>}
      </div>

      <button
        className={styles.menuToggle}
        type="button"
        aria-label={menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation-panel"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
    </header>
  )
}

export default SiteHeader
