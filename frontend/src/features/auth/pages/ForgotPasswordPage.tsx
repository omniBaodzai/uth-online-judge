import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import uthLogo from '../../../assets/uth_logo.png'
import styles from './AuthPage.module.css'
import pageStyles from './ForgotPasswordPage.module.css'

const CODE_LENGTH = 6

function PasswordInput({ id, label }: { id: string; label: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <span className={styles.fieldIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="4.5" y="10" width="15" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <input
          className={styles.input}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          placeholder={label}
        />
        <button
          className={styles.passwordToggle}
          type="button"
          aria-label={visible ? `Ẩn ${label.toLocaleLowerCase('vi')}` : `Hiện ${label.toLocaleLowerCase('vi')}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
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

function ForgotPasswordPage() {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  function updateCodeAt(index: number, value: string) {
    const digits = value.replace(/\D/g, '')
    if (!digits) {
      setCode((current) => current.map((digit, position) => position === index ? '' : digit))
      return
    }

    const next = [...code]
    for (const [offset, digit] of [...digits].slice(0, CODE_LENGTH - index).entries()) {
      next[index + offset] = digit
    }
    setCode(next)
    inputRefs.current[Math.min(index + digits.length, CODE_LENGTH - 1)]?.focus()
  }

  function handleCodeKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleCodePaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!digits) return
    event.preventDefault()
    const next = Array(CODE_LENGTH).fill('')
    for (const [index, digit] of [...digits].entries()) next[index] = digit
    setCode(next)
    inputRefs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus()
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${pageStyles.main}`} id="main-content">
        <section className={`${styles.card} ${pageStyles.card}`} aria-labelledby="forgot-password-title">
          <Link className={styles.logoLink} to="/" aria-label="Về trang chủ UTH Online Judge">
            <img src={uthLogo} alt="Đại học Giao thông vận tải Thành phố Hồ Chí Minh" />
          </Link>
          <h1 className={styles.title} id="forgot-password-title">Lấy lại mật khẩu</h1>
          <p className={styles.intro}>
            Khôi phục mật khẩu qua email, mã sẽ gửi qua email bạn đã đăng ký tài khoản để thay đổi mật khẩu
          </p>

          <form className={`${styles.form} ${pageStyles.form}`} onSubmit={(event) => event.preventDefault()}>
            <section className={pageStyles.step} aria-labelledby="email-step-title">
              <h2 className={pageStyles.stepTitle} id="email-step-title">
                <span>1</span>
                Xác nhận email
              </h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="recovery-email">Email</label>
                <div className={styles.inputWrap}>
                  <span className={styles.fieldIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                      <path d="m4.5 7 7.5 6 7.5-6" />
                    </svg>
                  </span>
                  <input
                    className={styles.input}
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    placeholder="Nhập email đã đăng ký"
                  />
                </div>
              </div>
              <button className={styles.submitButton} type="button">
                Gửi mã xác nhận
              </button>
            </section>

            <section className={pageStyles.step} aria-labelledby="code-step-title">
              <h2 className={pageStyles.stepTitle} id="code-step-title">
                <span>2</span>
                Nhập mã xác nhận
              </h2>
              <div className={pageStyles.codeInputs} role="group" aria-label="Mã xác nhận gồm 6 chữ số">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element }}
                    className={pageStyles.codeInput}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Chữ số ${index + 1}`}
                    maxLength={CODE_LENGTH}
                    value={digit}
                    onChange={(event) => updateCodeAt(index, event.target.value)}
                    onKeyDown={(event) => handleCodeKeyDown(index, event)}
                    onPaste={handleCodePaste}
                  />
                ))}
              </div>
              <div className={pageStyles.resendRow}>
                <span>Chưa nhận được mã?</span>
                <button className={pageStyles.resendButton} type="button">Gửi lại mã xác nhận</button>
              </div>
            </section>

            <section className={pageStyles.step} aria-labelledby="password-step-title">
              <h2 className={pageStyles.stepTitle} id="password-step-title">
                <span>3</span>
                Tạo mật khẩu mới
              </h2>
              <PasswordInput id="new-password" label="Mật khẩu mới" />
              <PasswordInput id="confirm-password" label="Nhập lại mật khẩu mới" />
              <button className={styles.submitButton} type="button">
                Xác nhận
              </button>
            </section>
          </form>

          <p className={`${styles.switchPrompt} ${pageStyles.backLink}`}>
            <Link to="/login">← Quay lại đăng nhập</Link>
          </p>
          <p className={pageStyles.disclaimer}>
            Giao diện hiện chưa kết nối dịch vụ gửi email hoặc đổi mật khẩu.
          </p>
        </section>
      </main>
    </div>
  )
}

export default ForgotPasswordPage
