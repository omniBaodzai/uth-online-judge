import { useState, type FormEvent, type ReactNode } from 'react'
import SiteFooter from '../../../components/layout/SiteFooter'
import SiteHeader from '../../../components/layout/SiteHeader'
import uthLogo from '../../../assets/uth_logo.png'
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
    googleLabel: 'Đăng ký qua Google',
    githubLabel: 'Đăng ký qua GitHub',
    switchPrompt: 'Bạn đã có tài khoản?',
    switchLabel: 'Đăng nhập ngay',
    switchHref: '/login',
  },
  login: {
    title: 'Đăng nhập hệ thống',
    submitLabel: 'Đăng nhập',
    googleLabel: 'Đăng nhập qua Google',
    githubLabel: 'Đăng nhập qua GitHub',
    switchPrompt: 'Bạn chưa có tài khoản?',
    switchLabel: 'Đăng ký ngay',
    switchHref: '/register',
  },
} satisfies Record<AuthMode, {
  title: string
  submitLabel: string
  googleLabel: string
  githubLabel: string
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.72-.06-1.41-.18-2.08H12v3.94h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.23c1.9-1.75 2.99-4.33 2.99-7.4Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.23-2.52c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.6-4.13H3.07v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.4 13.94a6.02 6.02 0 0 1 0-3.88v-2.6H3.07a10 10 0 0 0 0 9.08l3.33-2.6Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.93c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.96 2.9 14.7 2 12 2a10 10 0 0 0-8.93 5.46l3.33 2.6c.8-2.37 3-4.13 5.6-4.13Z"
      />
    </svg>
  )
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.31-3.76-1.31-.5-1.29-1.24-1.63-1.24-1.63-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.56 3.43 1.8.1-.73.4-1.23.7-1.51-2.47-.28-5.07-1.24-5.07-5.5 0-1.22.44-2.21 1.16-2.99-.12-.28-.5-1.42.11-2.95 0 0 .95-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.1-1.43 3.05-1.14 3.05-1.14.61 1.53.23 2.67.11 2.95.72.78 1.16 1.77 1.16 2.99 0 4.27-2.6 5.21-5.08 5.49.4.35.75 1.02.75 2.06v3.06c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"
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
  placeholder,
  required = true,
}: {
  id: string
  label: string
  icon: FieldIconName
  type?: string
  autoComplete: string
  minLength?: number
  maxLength?: number
  placeholder?: string
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
          required={required}
          placeholder={placeholder ?? `Nhập ${label.toLocaleLowerCase('vi')}`}
        />
      </div>
    </div>
  )
}

function PasswordField({ mode }: { mode: AuthMode }) {
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
          required
          placeholder="Nhập mật khẩu"
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
    </div>
  )
}

function AuthPage({ mode }: AuthPageProps) {
  const copy = authCopy[mode]
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('Giao diện đã kiểm tra dữ liệu. Chức năng xác thực chưa được kết nối.')
  }

  function handleProvider(provider: string) {
    setNotice(`Đăng nhập qua ${provider} chưa được cấu hình.`)
  }

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#auth-main">
        Bỏ qua điều hướng, đến biểu mẫu
      </a>
      <SiteHeader />

      <main className={styles.main} id="auth-main">
        <section className={styles.card} aria-labelledby="auth-title">
          <a className={styles.logoLink} href="/" aria-label="Về trang chủ UTH Online Judge">
            <img src={uthLogo} alt="Đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
          </a>
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
              placeholder={mode === 'login' ? 'Nhập tên đăng nhập hoặc email' : undefined}
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
            <PasswordField mode={mode} />

            {mode === 'login' && (
              <a className={styles.forgotLink} href="mailto:oj@uth.edu.vn?subject=Khoi%20phuc%20mat%20khau">
                Quên mật khẩu?
              </a>
            )}

            <button className={styles.submitButton} type="submit">
              {copy.submitLabel}
            </button>
          </form>

          <div className={styles.divider} aria-label="Hoặc">
            <span />
            <span className={styles.dividerText}>Hoặc</span>
            <span />
          </div>

          <div className={styles.providerActions}>
            <ProviderButton
              icon={<GoogleMark />}
              label={copy.googleLabel}
              onClick={() => handleProvider('Google')}
            />
            <ProviderButton
              icon={<GithubMark />}
              label={copy.githubLabel}
              onClick={() => handleProvider('GitHub')}
            />
          </div>

          <p className={styles.notice} role="status" aria-live="polite">
            {notice}
          </p>

          <p className={styles.switchPrompt}>
            {copy.switchPrompt}{' '}
            <a href={copy.switchHref}>{copy.switchLabel}</a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function ProviderButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={styles.providerButton} type="button" onClick={onClick}>
      <span className={styles.providerIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default AuthPage
