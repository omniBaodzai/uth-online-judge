import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import uthLogo from '../../../assets/uth_logo.png'
import { ApiError, startGitHubOAuth, startGoogleOAuth } from '../api'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import { getReturnPath } from '../return-path'
import { useAuth } from '../useAuth'
import styles from './AuthPage.module.css'

type AuthMode = 'register' | 'login'
type FieldIconName = 'user' | 'mail' | 'lock'

type AuthPageProps = {
  mode: AuthMode
}

function FieldIcon({ name }: { name: FieldIconName }) {
  if (name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.5-3.3 3.2-5.5 7-5.5s6.5 2.2 7 5.5" />
      </svg>
    )
  }

  if (name === 'mail') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m4.5 7 7.5 6 7.5-6" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2" />
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: 'google' | 'github' }) {
  if (provider === 'google') {
    return (
      <svg className={styles.providerIcon} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
        <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" />
        <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z" />
        <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
      </svg>
    )
  }

  return (
    <svg className={styles.providerIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.1 1.2a10.7 10.7 0 0 1 5.7 0c2.1-1.5 3.1-1.2 3.1-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2v3c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9Z"
      />
    </svg>
  )
}

function FormField({
  id,
  label,
  icon,
  type = 'text',
  autoComplete,
  minLength,
  maxLength,
  pattern,
  placeholder,
  defaultValue,
  error,
  floatingLabel = false,
  required = true,
}: {
  id: string
  label: string
  icon: FieldIconName
  type?: string
  autoComplete: string
  minLength?: number
  maxLength?: number
  pattern?: string
  placeholder?: string
  defaultValue?: string
  error?: string
  floatingLabel?: boolean
  required?: boolean
}) {
  return (
    <div className={`${styles.field} ${floatingLabel ? styles.floatingField : ''}`}>
      {!floatingLabel && <label className={styles.label} htmlFor={id}>
        {label}
      </label>}
      <div className={`${styles.inputWrap} ${floatingLabel ? styles.floatingInputWrap : ''}`}>
        <span className={styles.fieldIcon}>
          <FieldIcon name={icon} />
        </span>
        <input
          className={styles.input}
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          pattern={pattern}
          required={required}
          defaultValue={defaultValue}
          placeholder={floatingLabel ? ' ' : placeholder ?? `Nhập ${label.toLocaleLowerCase('vi')}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {floatingLabel && (
          <label className={styles.floatingLabel} htmlFor={id}>
            {label}
          </label>
        )}
      </div>
      {error && <span className={styles.fieldError} id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}

function PasswordField({
  mode,
  error,
  floatingLabel = false,
}: {
  mode: AuthMode
  error?: string
  floatingLabel?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [password, setPassword] = useState('')
  const [meterVisible, setMeterVisible] = useState(false)
  const { t } = useTranslation('auth')
  const label = t('password')
  const strengthId = 'registration-password-strength'

  return (
    <div className={`${styles.field} ${floatingLabel ? styles.floatingField : ''}`}>
      {!floatingLabel && <label className={styles.label} htmlFor="password">
        {label}
      </label>}
      <div className={`${styles.inputWrap} ${floatingLabel ? styles.floatingInputWrap : ''}`}>
        <span className={styles.fieldIcon}>
          <FieldIcon name="lock" />
        </span>
        <input
          className={styles.input}
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={mode === 'register' ? 8 : undefined}
          maxLength={72}
          required
          placeholder={floatingLabel ? ' ' : t('enterPassword')}
          aria-invalid={Boolean(error)}
          aria-describedby={[
            error ? 'password-error' : null,
            mode === 'register' && meterVisible ? strengthId : null,
          ].filter(Boolean).join(' ') || undefined}
          onChange={mode === 'register' ? (event) => setPassword(event.target.value) : undefined}
          onFocus={mode === 'register' ? (event) => {
            setPassword(event.currentTarget.value)
            setMeterVisible(true)
          } : undefined}
          onBlur={mode === 'register' ? (event) => {
            const currentPassword = event.currentTarget.value
            setPassword(currentPassword)
            if (!currentPassword) setMeterVisible(false)
          } : undefined}
        />
        {floatingLabel && (
          <label className={styles.floatingLabel} htmlFor="password">
            {label}
          </label>
        )}
        <button
          className={styles.passwordToggle}
          type="button"
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((isVisible) => !isVisible)}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.4 0 9 7 9 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.6 7 9 7c1.1 0 2.1-.3 3-.7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          )}
        </button>
      </div>
      {error && <span className={styles.fieldError} id="password-error" role="alert">{error}</span>}
      {mode === 'register' && meterVisible ? (
        <PasswordStrengthMeter id={strengthId} password={password} />
      ) : null}
    </div>
  )
}

const SAVED_IDENTIFIER_KEY = 'uth_remembered_identifier'
const REMEMBER_OPT_OUT_KEY = 'uth_remember_opt_out'

// Chỉ lưu tên đăng nhập/email (không nhạy cảm). Mật khẩu KHÔNG bao giờ được ghi vào
// localStorage/sessionStorage/cookie; việc lưu mật khẩu giao cho trình quản lý mật khẩu của trình duyệt.
function readSavedIdentifier(): string {
  try {
    return window.localStorage.getItem(SAVED_IDENTIFIER_KEY) ?? ''
  } catch {
    return ''
  }
}

function readRememberPreference(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_OPT_OUT_KEY) !== '1'
  } catch {
    return true
  }
}

function oauthErrorMessage(code: string, provider: 'google' | 'github'): string {
  const providerName = provider === 'github' ? 'GitHub' : 'Google'
  switch (code) {
    case 'provider_cancelled':
      return `Bạn đã hủy đăng nhập ${providerName}. Bạn có thể thử lại bất cứ lúc nào.`
    case 'account_exists':
      return `Email ${providerName} này đã có tài khoản. Vui lòng đăng nhập bằng phương thức hiện tại.`
    case 'account_disabled':
      return 'Tài khoản UTH này hiện không hoạt động. Vui lòng liên hệ quản trị viên.'
    case 'email_unverified':
      return `${providerName} chưa cung cấp email đã xác minh. Hãy xác minh email trên ${providerName} rồi thử lại.`
    case 'state_invalid':
      return `Phiên xác thực ${providerName} không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.`
    case 'provider_unavailable':
      return `Đăng nhập ${providerName} hiện chưa sẵn sàng. Vui lòng thử lại sau.`
    default:
      return `Không thể xác thực với ${providerName}. Vui lòng thử lại.`
  }
}

function saveRememberPreference(remember: boolean, identifier: string) {
  try {
    if (remember) {
      window.localStorage.setItem(SAVED_IDENTIFIER_KEY, identifier)
      window.localStorage.removeItem(REMEMBER_OPT_OUT_KEY)
    } else {
      window.localStorage.removeItem(SAVED_IDENTIFIER_KEY)
      window.localStorage.setItem(REMEMBER_OPT_OUT_KEY, '1')
    }
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage.
  }
}

type PasswordCredentialConstructor = new (data: {
  id: string
  password: string
}) => Credential

// Yêu cầu trình duyệt lưu mật khẩu vào kho an toàn của nó (Chromium); trình duyệt khác bỏ qua.
async function storeBrowserCredential(identifier: string, password: string) {
  const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor })
    .PasswordCredential
  if (!Ctor || !navigator.credentials?.store) return
  try {
    await navigator.credentials.store(new Ctor({ id: identifier, password }))
  } catch {
    // Không ảnh hưởng luồng đăng nhập nếu trình duyệt từ chối.
  }
}

function AuthPage({ mode }: AuthPageProps) {
  const { t } = useTranslation('auth')
  const copy = {
    title: t(mode === 'register' ? 'registerTitle' : 'loginTitle'),
    submitLabel: t(mode === 'register' ? 'submitRegister' : 'submitLogin'),
    switchPrompt: t(mode === 'register' ? 'switchToLoginPrompt' : 'switchToRegisterPrompt'),
    switchLabel: t(mode === 'register' ? 'switchToLogin' : 'switchToRegister'),
    switchHref: mode === 'register' ? '/login' : '/register',
  }
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const initialOAuthParams = new URLSearchParams(search)
  const initialOAuthError = initialOAuthParams.get('oauthError')
  const initialOAuthProvider = initialOAuthParams.get('oauthProvider') === 'github'
    ? 'github'
    : 'google'
  const {
    login,
    register,
    isAuthenticated,
    isLoading: restoringSession,
    initializationError,
  } = useAuth()
  const [savedIdentifier] = useState(readSavedIdentifier)
  const [rememberMe, setRememberMe] = useState(readRememberPreference)
  const [notice, setNotice] = useState(() =>
    initialOAuthError ? oauthErrorMessage(initialOAuthError, initialOAuthProvider) : '',
  )
  const [noticeType, setNoticeType] = useState<'error' | 'success' | ''>(() =>
    initialOAuthError ? 'error' : '',
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const redirectTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(redirectTimer.current), [])

  useEffect(() => {
    const params = new URLSearchParams(search)
    const oauthError = params.get('oauthError')
    if (!oauthError) return

    params.delete('oauthError')
    params.delete('oauthProvider')
    const nextSearch = params.toString()
    navigate(
      { pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true },
    )
  }, [navigate, pathname, search])

  // Phiên được khôi phục từ cookie: không cần đăng nhập lại.
  useEffect(() => {
    if (isAuthenticated && !isSubmitting) navigate(getReturnPath(search), { replace: true })
  }, [isAuthenticated, isSubmitting, navigate, search])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('')
    setNoticeType('')
    setFieldErrors({})
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    let succeeded = false

    try {
      if (mode === 'register') {
        await register(username, email, password)
        setNotice(t('registerSuccess'))
        setNoticeType('success')
      } else {
        await login(username, password, rememberMe)
        saveRememberPreference(rememberMe, username)
        if (rememberMe) await storeBrowserCredential(username, password)
        else void navigator.credentials?.preventSilentAccess?.()
        setNotice(t('loginSuccess'))
        setNoticeType('success')
      }

      succeeded = true
      redirectTimer.current = window.setTimeout(() => {
        navigate(getReturnPath(search), { replace: true })
      }, 650)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFieldErrors({ password: t('invalidCredentials') })
      } else if (error instanceof ApiError && error.status === 409) {
        setNotice(t('accountAlreadyExists'))
        setNoticeType('error')
      } else if (error instanceof ApiError && error.status === 400) {
        setNotice(error.message)
        setNoticeType('error')
      } else {
        setNotice(error instanceof Error ? error.message : t('requestFailed'))
        setNoticeType('error')
      }
    } finally {
      if (!succeeded) setIsSubmitting(false)
    }
  }

  function handleGoogleOAuth() {
    setNotice('')
    setNoticeType('')
    setIsSubmitting(true)
    try {
      startGoogleOAuth(mode, mode === 'register' || rememberMe)
    } catch {
      setIsSubmitting(false)
      setNotice(t('googleStartError'))
      setNoticeType('error')
    }
  }

  function handleGitHubOAuth() {
    setNotice('')
    setNoticeType('')
    setIsSubmitting(true)
    try {
      startGitHubOAuth(mode, mode === 'register' || rememberMe)
    } catch {
      setIsSubmitting(false)
      setNotice(t('githubStartError'))
      setNoticeType('error')
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main} id="main-content">
        <section className={styles.card} aria-labelledby="auth-title">
          <Link className={styles.logoLink} to="/" aria-label={t('homeLabel', { ns: 'common' })}>
            <img src={uthLogo} alt={t('university', { ns: 'common' })} />
          </Link>
          <h1 className={styles.title} id="auth-title">
            {copy.title}
          </h1>
          <p className={styles.intro}>
            {t(mode === 'register' ? 'registerIntro' : 'welcomeBack')}
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <FormField
              id="username"
              label={t(mode === 'login' ? 'identifier' : 'username')}
              icon="user"
              autoComplete="username"
              minLength={mode === 'register' ? 3 : undefined}
              maxLength={mode === 'login' ? 254 : 32}
              pattern={mode === 'register' ? '[A-Za-z0-9._-]+' : undefined}
              placeholder={mode === 'login' ? t('enterIdentifier') : undefined}
              defaultValue={mode === 'login' ? savedIdentifier : undefined}
              error={fieldErrors.username}
              floatingLabel
            />
            {mode === 'register' && (
              <FormField
                id="email"
                label="Email"
                icon="mail"
                type="email"
                autoComplete="email"
                maxLength={254}
                floatingLabel
              />
            )}
            <PasswordField
              key={mode}
              mode={mode}
              error={fieldErrors.password}
              floatingLabel
            />

            {mode === 'login' && (
              <div className={styles.loginOptions}>
                <label className={styles.rememberMe} htmlFor="remember-me">
                  <input
                    id="remember-me"
                    name="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>{t('rememberLogin')}</span>
                </label>
                <Link className={styles.forgotLink} to="/forgot-password">
                  {t('forgotPasswordLink')}
                </Link>
              </div>
            )}

            <button
              className={styles.submitButton}
              type="submit"
              disabled={isSubmitting || restoringSession}
            >
              {isSubmitting ? t('processing') : copy.submitLabel}
            </button>
            <div className={styles.oauthDivider} aria-hidden="true">
              <span>{t('or')}</span>
            </div>
            <div className={styles.oauthButtons}>
              <button
                className={`${styles.oauthButton} ${styles.googleButton}`}
                type="button"
                disabled={isSubmitting || restoringSession}
                aria-label={`${copy.submitLabel} ${t('viaGoogle')}`}
                onClick={handleGoogleOAuth}
              >
                <ProviderIcon provider="google" />
                <span>{copy.submitLabel} {t('viaGoogle')}</span>
              </button>
              <button
                className={`${styles.oauthButton} ${styles.githubButton}`}
                type="button"
                disabled={isSubmitting || restoringSession}
                aria-label={`${copy.submitLabel} ${t('viaGithub')}`}
                onClick={handleGitHubOAuth}
              >
                <ProviderIcon provider="github" />
                <span>{copy.submitLabel} {t('viaGithub')}</span>
              </button>
            </div>
          </form>

          <p
            className={`${styles.notice} ${noticeType === 'error' || initializationError ? styles.noticeError : ''} ${noticeType === 'success' ? styles.noticeSuccess : ''}`}
            role={noticeType === 'error' || initializationError ? 'alert' : 'status'}
            aria-live={noticeType === 'error' || initializationError ? 'assertive' : 'polite'}
          >
            {notice || initializationError}
          </p>

          <p className={styles.switchPrompt}>
            {copy.switchPrompt}{' '}
            <Link to={copy.switchHref}>{copy.switchLabel}</Link>
          </p>
        </section>
      </main>
    </div>
  )
}

export default AuthPage
