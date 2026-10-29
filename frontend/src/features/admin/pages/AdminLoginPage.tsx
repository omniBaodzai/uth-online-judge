import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminIcon } from '../components/AdminIcons'
import uthLogo from '../../../assets/uth_logo.png'
import styles from '../admin.module.css'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../auth/api'

function AdminLoginPage() {
  const { login, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user?.role === 'ADMIN') navigate('/admin', { replace: true })
  }, [navigate, user])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const authenticatedUser = await login(identifier, password, true)
      if (authenticatedUser.role !== 'ADMIN') {
        setMessage('Tài khoản này chưa được cấp quyền Admin. Hãy liên hệ quản trị hệ thống.')
        return
      }
      navigate('/admin', { replace: true })
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="admin-login-title">
        <Link className={styles.loginBrand} to="/" aria-label="Quay về UTH Online Judge">
          <img className={styles.loginLogo} src={uthLogo} alt="Đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
        </Link>
        <h1 id="admin-login-title">Quản trị viên</h1>
        <form className={styles.loginForm} onSubmit={submit} aria-busy={submitting}>
          <label htmlFor="admin-identifier">Email hoặc tên đăng nhập</label>
          <input
            autoComplete="username"
            id="admin-identifier"
            name="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="admin@uth.edu.vn"
          />
          <label htmlFor="admin-password">Mật khẩu</label>
          <div className={styles.passwordField}>
            <input
              autoComplete="current-password"
              id="admin-password"
              name="password"
              required
              type={passwordVisible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
            />
            <button type="button" aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>
              <AdminIcon name="eye" />
            </button>
          </div>
          <button className={styles.buttonPrimary} type="submit" disabled={submitting || isLoading}>
            {submitting ? 'Đang đăng nhập…' : isLoading ? 'Đang kiểm tra phiên…' : 'Đăng nhập'}
          </button>
          {message && <p id="admin-login-error" className={styles.formMessage} role="alert">{message}</p>}
        </form>
        <Link className={styles.backLink} to="/">← Quay lại trang học viên</Link>
      </section>
    </main>
  )
}

export default AdminLoginPage
