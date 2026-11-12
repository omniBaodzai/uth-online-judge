import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Globe, KeyRound, LogOut, Monitor, Moon, Sun, UserRound, UserRoundPen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './SiteHeader.module.css'
import uthLogo from '../../assets/uth_logo.png'
import { useAuth } from '../../features/auth/useAuth'
import { resolveAvatarUrl } from '../../features/auth/api'
import UserAvatar from '../../features/profile/components/UserAvatar'
import NotificationBell from './notifications/NotificationBell'
import ChangePasswordDialog from './ChangePasswordDialog'
import { useToast } from '../ui/toast-context'
import { useTheme } from '../../theme/useTheme'
import { changeLanguage } from '../../i18n'

const navigationLinks = [
  { label: 'problems', href: '/problems' },
  { label: 'submissions', href: '/submissions' },
  { label: 'leaderboard', href: '/leaderboard' },
  { label: 'contests', href: '/contests' },
  { label: 'organizations', href: '/organizations' },
  { label: 'contact', href: '/contact' },
]

const LOGOUT_TOAST_DURATION_MS = 5000

function SiteHeader() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [logoutSuccess, setLogoutSuccess] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const { showToast } = useToast()
  const { user, isLoading: isRestoringSession, logout } = useAuth()
  const { t, i18n } = useTranslation('common')
  const { mode, resolvedTheme, setMode } = useTheme()
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const nextTheme = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
  const themeName = t(`theme${mode[0]?.toUpperCase()}${mode.slice(1)}`)

  function toggleLanguage() {
    void changeLanguage(language === 'vi' ? 'en' : 'vi')
  }

  function renderAppearanceControls(showThemeLabel = false) {
    return (
      <div className={styles.appearanceControls} aria-label={t('appearanceSettings')}>
        <button
          className={styles.appearanceButton}
          type="button"
          aria-label={`${t('selectTheme')}: ${themeName}`}
          title={`${t('theme')}: ${themeName}`}
          onClick={() => setMode(nextTheme)}
        >
          {showThemeLabel || mode === 'system' ? (
            <Monitor size={17} aria-hidden="true" />
          ) : resolvedTheme === 'dark' ? (
            <Moon size={17} aria-hidden="true" />
          ) : (
            <Sun size={17} aria-hidden="true" />
          )}
          {showThemeLabel && <span>{t('theme')}</span>}
        </button>
        <button
          className={styles.languageButton}
          type="button"
          aria-label={`${t('selectLanguage')}: ${language === 'vi' ? t('languageVietnamese') : t('languageEnglish')}`}
          title={`${t('language')}: ${language === 'vi' ? t('languageVietnamese') : t('languageEnglish')}`}
          onClick={toggleLanguage}
        >
          <Globe size={16} aria-hidden="true" />
          <span>{language.toUpperCase()}</span>
        </button>
      </div>
    )
  }

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await logout()
      setAccountMenuOpen(false)
      setLogoutSuccess(true)
      navigate('/', { replace: true })
    } catch {
      setLogoutError(t('logoutError'))
    } finally {
      setIsLoggingOut(false)
    }
  }

  function closeChangePasswordDialog() {
    setChangePasswordOpen(false)
    window.requestAnimationFrame(() => accountButtonRef.current?.focus())
  }

  function handlePasswordChanged() {
    setChangePasswordOpen(false)
    showToast(t('passwordChanged'))
    window.requestAnimationFrame(() => accountButtonRef.current?.focus())
  }

  useEffect(() => {
    if (!logoutSuccess) return
    const timeoutId = window.setTimeout(
      () => setLogoutSuccess(false),
      LOGOUT_TOAST_DURATION_MS,
    )
    return () => window.clearTimeout(timeoutId)
  }, [logoutSuccess])

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
      {/* Thẻ <a> thường để tải lại toàn trang, kể cả khi đang ở trang chủ. */}
      <a
        className={styles.brand}
        href="/"
        aria-label={t('homeLabel')}
        onClick={() => window.scrollTo(0, 0)}
      >
        <img src={uthLogo} alt={t('university')} />
      </a>

      <div
        className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}
        id="primary-navigation-panel"
      >
        <nav className={styles.navigation} aria-label={t('navLabel')}>
          <ul className={styles.navigationList}>
            {navigationLinks.map(({ label, href }) => (
              <li key={href}>
                {href.startsWith('/') ? (
                  <NavLink
                    className={styles.navigationLink}
                    to={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(label)}
                  </NavLink>
                ) : (
                  <a
                    className={styles.navigationLink}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(label)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.accountActions} aria-busy={isRestoringSession && !user}>
          {!user && renderAppearanceControls()}
          {isRestoringSession && !user ? (
            <div className={styles.accountSkeleton} role="status" aria-label={t('checkingSession')}>
              <span />
              <span />
            </div>
          ) : user ? (
            <>
              <div className={styles.accountControls}>
                <NotificationBell key={user.id} userId={user.id} />
                <div className={styles.accountMenu} ref={accountMenuRef}>
                  <button
                    className={styles.accountButton}
                    type="button"
                    ref={accountButtonRef}
                    aria-expanded={accountMenuOpen}
                    aria-controls="account-menu"
                    aria-label={t('accountMenu')}
                    onClick={() => setAccountMenuOpen((open) => !open)}
                  >
                    <UserAvatar
                      source={resolveAvatarUrl(user.avatar_url)}
                      username={user.username ?? user.email}
                    />
                    <span className={styles.userGreeting}>
                      <span className={styles.greetingLabel}>{t('accountGreeting')}</span>
                      <span className={styles.username} title={user.username ?? user.email}>
                        {user.username ?? user.email}
                      </span>
                    </span>
                    <span className={styles.accountChevron} aria-hidden="true">⌄</span>
                  </button>
                  {accountMenuOpen && (
                    <div className={styles.accountDropdown} id="account-menu">
                      <Link
                        to="/profile"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setMenuOpen(false)
                        }}
                      >
                        <UserRound size={18} aria-hidden="true" />
                        {t('profile')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setChangePasswordOpen(true)
                        }}
                      >
                        <KeyRound size={18} aria-hidden="true" />
                        {t('changePassword')}
                      </button>
                      <Link
                        to="/profile/edit"
                        onClick={() => {
                          setAccountMenuOpen(false)
                          setMenuOpen(false)
                        }}
                      >
                        <UserRoundPen size={18} aria-hidden="true" />
                        {t('editProfile')}
                      </Link>
                      <div className={styles.appearanceDivider} aria-hidden="true" />
                      {renderAppearanceControls(true)}
                      <div className={styles.appearanceDivider} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={isLoggingOut}
                      >
                        <LogOut size={18} aria-hidden="true" />
                        {t(isLoggingOut ? 'loggingOut' : 'logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Link className={styles.registerLink} to="/register" onClick={() => setMenuOpen(false)}>
                {t('register')}
              </Link>
              <Link className={styles.loginLink} to="/login" onClick={() => setMenuOpen(false)}>
                {t('login')}
              </Link>
            </>
          )}
        </div>
        {logoutError && <p className={styles.logoutError} role="alert">{logoutError}</p>}
      </div>

      {logoutSuccess && !user && (
        <div
          className={styles.logoutSuccess}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className={styles.successIcon} aria-hidden="true">✓</span>
          <span>
            <strong>{t('logoutSuccess')}</strong>
            <span>{t('seeYou')}</span>
          </span>
          <button
            type="button"
            aria-label={t('closeLogoutNotice')}
            onClick={() => setLogoutSuccess(false)}
          >
            ×
          </button>
        </div>
      )}

      {changePasswordOpen && (
        <ChangePasswordDialog
          onClose={closeChangePasswordDialog}
          onSuccess={handlePasswordChanged}
        />
      )}

      <button
        className={styles.menuToggle}
        type="button"
        aria-label={t(menuOpen ? 'closeNavigation' : 'openNavigation')}
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
