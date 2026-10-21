import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import uthLogo from '../../../assets/uth_logo.png'
import { ApiError } from '../api'
import { useAuth } from '../useAuth'
import styles from './AuthPage.module.css'

type AuthMode = 'register' | 'login'
type FieldIconName = 'user' | 'mail' | 'lock'

type AuthPageProps = {
  mode: AuthMode
}

const authCopy = {
  register: {
    title: 'Đăng ký tài khoản',
    submitLabel: 'Đăng ký',
    switchPrompt: 'Bạn đã có tài khoản?',
    switchLabel: 'Đăng nhập ngay',
    switchHref: '/login',
  },
  login: {
    title: 'Đăng nhập hệ thống',
    submitLabel: 'Đăng nhập',
    switchPrompt: 'Bạn chưa có tài khoản?',
    switchLabel: 'Đăng ký ngay',
    switchHref: '/register',
  },
} satisfies Record<AuthMode, {
  title: string
  submitLabel: string
  switchPrompt: string
  switchLabel: string
  switchHref: string
}>

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
  error,
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
  error?: string
  required?: boolean
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
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
          placeholder={placeholder ?? `Nhập ${label.toLocaleLowerCase('vi')}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && <span className={styles.fieldError} id={`${id}-error`} role="alert">{error}</span>}
    </div>
  )
}

function PasswordField({ mode, error }: { mode: AuthMode; error?: string }) {
  const [visible, setVisible] = useState(false)
  const label = 'Mật khẩu'

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="password">
        {label}
      </label>
      <div className={styles.inputWrap}>
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
          placeholder="Nhập mật khẩu"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'password-error' : undefined}
        />
        <button
          className={styles.passwordToggle}
          type="button"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
    </div>
  )
}

function AuthPage({ mode }: AuthPageProps) {
  const copy = authCopy[mode]
  const { login, register, isLoading: restoringSession, initializationError } = useAuth()
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState<'error' | 'success' | ''>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { search } = useLocation()
  const redirectTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(redirectTimer.current), [])

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
        setNotice('Đăng ký thành công! Đang chuyển về trang chủ…')
        setNoticeType('success')
      } else {
        await login(username, password)
        setNotice('Đăng nhập thành công! Đang chuyển tiếp…')
        setNoticeType('success')
      }

      succeeded = true
      redirectTimer.current = window.setTimeout(() => {
        navigate(getReturnPath(search), { replace: true })
      }, 650)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFieldErrors({ password: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.' })
      } else if (error instanceof ApiError && error.status === 409) {
        setNotice('Tên đăng nhập hoặc email đã được sử dụng. Vui lòng thử thông tin khác.')
        setNoticeType('error')
      } else if (error instanceof ApiError && error.status === 400) {
        setNotice(error.message)
        setNoticeType('error')
      } else {
        setNotice(error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
        setNoticeType('error')
      }
    } finally {
      if (!succeeded) setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main} id="main-content">
        <section className={styles.card} aria-labelledby="auth-title">
          <Link className={styles.logoLink} to="/" aria-label="Về trang chủ UTH Online Judge">
            <img src={uthLogo} alt="Đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
          </Link>
          <h1 className={styles.title} id="auth-title">
            {copy.title}
          </h1>
          <p className={styles.intro}>
            {mode === 'register'
              ? 'Tạo tài khoản để bắt đầu hành trình chinh phục lập trình.'
              : 'Chào mừng bạn quay lại với cộng đồng lập trình UTH.'}
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <FormField
              id="username"
              label="Tên đăng nhập"
              icon="user"
              autoComplete={mode === 'register' ? 'username' : 'username'}
              minLength={mode === 'register' ? 3 : undefined}
              maxLength={mode === 'login' ? 254 : 32}
              pattern={mode === 'register' ? '[A-Za-z0-9._-]+' : undefined}
              placeholder={mode === 'login' ? 'Nhập tên đăng nhập hoặc email' : undefined}
              error={fieldErrors.username}
            />
            {mode === 'register' && (
              <FormField
                id="email"
                label="Email"
                icon="mail"
                type="email"
                autoComplete="email"
                maxLength={254}
              />
            )}
            <PasswordField mode={mode} error={fieldErrors.password} />

            <button
              className={styles.submitButton}
              type="submit"
              disabled={isSubmitting || restoringSession}
            >
              {isSubmitting ? 'Đang xử lý…' : copy.submitLabel}
            </button>
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

function getReturnPath(search: string): string {
  const requestedPath = new URLSearchParams(search).get('returnTo')
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//') || requestedPath.includes('\\')) {
    return '/'
  }

  const destination = new URL(requestedPath, window.location.origin)
  return destination.origin === window.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : '/'
}

export default AuthPage
