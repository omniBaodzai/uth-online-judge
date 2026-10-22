import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'
import uthLogo from '../../../assets/uth_logo.png'
import { useAuth } from '../../auth/useAuth'
import styles from '../adminLogin.module.css'

const isStaff = (role?: string) => role === 'ADMIN' || role === 'MODERATOR'

function safeReturnPath(search: string) {
  const value = new URLSearchParams(search).get('returnTo')
  return value && /^\/admin(\/|$)/.test(value) && !value.startsWith('/admin/login') ? value : '/admin'
}

export default function AdminLoginPage() {
  const { user, isLoading, login } = useAuth()
  const { search } = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && isStaff(user.role)) return <Navigate to={safeReturnPath(search)} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập tài khoản và mật khẩu.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await login(identifier.trim(), password, false, (account) => isStaff(account.role))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập không thành công.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card} aria-labelledby="admin-login-title">
        <img className={styles.logo} src={uthLogo} alt="Trường đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
        <div className={styles.badge}><ShieldCheck size={16} aria-hidden="true" />Khu vực quản trị</div>
        <h1 id="admin-login-title">Đăng nhập quản trị</h1>
        <p className={styles.intro}>Chỉ dành cho quản trị viên và điều hành viên của hệ thống.</p>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <label className={styles.field}>
            Tài khoản
            <span className={styles.inputWrap}>
              <User size={17} aria-hidden="true" />
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="Email hoặc tên đăng nhập" maxLength={254} autoFocus />
            </span>
          </label>
          <label className={styles.field}>
            Mật khẩu
            <span className={styles.inputWrap}>
              <Lock size={17} aria-hidden="true" />
              <input type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Nhập mật khẩu" />
              <button type="button" className={styles.toggle} onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.submit} disabled={submitting || isLoading}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
      </main>
    </div>
  )
}
