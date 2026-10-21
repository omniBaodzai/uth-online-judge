import { useEffect, useState } from 'react'
import styles from './SiteHeader.module.css'
import uthLogo from '../../assets/uth_logo.png'

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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <header className={styles.header}>
      <a className={styles.brand} href="/" aria-label="UTH Online Judge - Trang chủ">
        <img src={uthLogo} alt="Trường đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
      </a>

      <div
        className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
        id="primary-navigation-panel"
      >
        <nav className={styles.navigation} aria-label="Điều hướng chính">
          <ul className={styles.navigationList}>
            {navigationLinks.map(({ label, href }) => (
              <li key={label}>
                <a
                  className={styles.navigationLink}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.accountActions}>
          <a className={styles.registerLink} href="/register">
            Đăng ký
          </a>
          <a className={styles.loginLink} href="/login">
            Đăng nhập
          </a>
        </div>
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
