import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import uthLogo from '../../../assets/uth_logo.png'
import {
  ApiError,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from '../api'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import styles from './AuthPage.module.css'
import pageStyles from './ForgotPasswordPage.module.css'

const CODE_LENGTH = 6

function PasswordInput({
  id,
  label,
  value,
  disabled,
  onChange,
  showStrength = false,
}: {
  id: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  showStrength?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [meterVisible, setMeterVisible] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const { t } = useTranslation('auth')
  const strengthId = `${id}-strength`
  const shouldShowMeter = showStrength
    && meterVisible
    && (inputFocused || value.length > 0)

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
          value={value}
          disabled={disabled}
          aria-describedby={shouldShowMeter ? strengthId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            onChange(event.currentTarget.value)
            setInputFocused(true)
            if (showStrength) setMeterVisible(true)
          }}
          onBlur={(event) => {
            setInputFocused(false)
            if (showStrength && !event.currentTarget.value) setMeterVisible(false)
          }}
        />
        <button
          className={styles.passwordToggle}
          type="button"
          aria-label={visible ? `${t('hidePassword')} ${label.toLocaleLowerCase()}` : `${t('showPassword')} ${label.toLocaleLowerCase()}`}
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
      {shouldShowMeter ? <PasswordStrengthMeter id={strengthId} password={value} /> : null}
    </div>
  )
}

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordResetSucceeded, setPasswordResetSucceeded] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const redirectTimer = useRef<number | null>(null)

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setTimeout(
      () => setCooldownSeconds((remaining) => Math.max(0, remaining - 1)),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [cooldownSeconds])

  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current)
  }, [])

  async function handleRequestOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await requestPasswordReset(email)
      setStep(2)
      setCooldownSeconds(response.retryAfterSeconds)
      setNotice(response.message)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.retryAfterSeconds) {
        setCooldownSeconds(requestError.retryAfterSeconds)
      }
      setError(getErrorMessage(requestError, t('sendCodeError')))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    const otp = code.join('')
    if (otp.length !== CODE_LENGTH) {
      setError(t('enterFullCode'))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await verifyPasswordResetOtp(email, otp)
      setResetToken(response.resetToken)
      setStep(3)
      setNotice(t('validCodeCreatePassword'))
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, t('verifyCodeError')))
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    if (!resetToken) {
      setError(t('invalidResetSession'))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await resetPassword(resetToken, newPassword)
      setPasswordResetSucceeded(true)
      setResetToken(null)
      setCode(Array(CODE_LENGTH).fill(''))
      setNewPassword('')
      setConfirmPassword('')
      setNotice(t('passwordResetSuccess'))
      redirectTimer.current = window.setTimeout(
        () => navigate('/login', { replace: true }),
        1200,
      )
    } catch (resetError) {
      setError(getErrorMessage(resetError, t('passwordResetError')))
    } finally {
      setBusy(false)
    }
  }

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
          <Link className={styles.logoLink} to="/" aria-label={t('homeLabel', { ns: 'common' })}>
            <img src={uthLogo} alt={t('university', { ns: 'common' })} />
          </Link>
          <h1 className={styles.title} id="forgot-password-title">{t('forgotTitle')}</h1>
          <p className={styles.intro}>
            {t('forgotDescription')}
          </p>

          <form className={`${styles.form} ${pageStyles.form}`} onSubmit={handleRequestOtp}>
            <section className={pageStyles.step} aria-labelledby="email-step-title">
              <h2 className={pageStyles.stepTitle} id="email-step-title">
                <span>1</span>
                {t('confirmEmail')}
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
                    placeholder={t('registeredEmail')}
                    value={email}
                    disabled={step > 1 || busy}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
              <button className={styles.submitButton} type="submit" disabled={busy || step > 1}>
                {busy && step === 1 ? t('sendingCode') : t('sendCode')}
              </button>
              {step === 1 && error ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p> : null}
            </section>

            <section className={pageStyles.step} aria-labelledby="code-step-title">
              <h2 className={pageStyles.stepTitle} id="code-step-title">
                <span>2</span>
                {t('enterCode')}
              </h2>
              <div className={pageStyles.codeInputs} role="group" aria-label={t('codeGroupLabel')}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { inputRefs.current[index] = element }}
                    className={pageStyles.codeInput}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={t('digitLabel', { index: index + 1 })}
                    maxLength={CODE_LENGTH}
                    value={digit}
                    disabled={step !== 2 || busy}
                    onChange={(event) => updateCodeAt(index, event.target.value)}
                    onKeyDown={(event) => handleCodeKeyDown(index, event)}
                    onPaste={handleCodePaste}
                  />
                ))}
              </div>
              <div className={pageStyles.resendRow}>
                <span>
                  {cooldownSeconds > 0
                    ? t('resendAvailableIn', { time: formatCountdown(cooldownSeconds) })
                    : t('codeNotReceived')}
                </span>
                <button
                  className={pageStyles.resendButton}
                  type="button"
                  disabled={busy || cooldownSeconds > 0 || step !== 2}
                  onClick={() => void handleRequestOtp()}
                >
                  {t('resendCode')}
                </button>
              </div>
              {step === 2 ? (
                <button
                  className={styles.submitButton}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleVerifyOtp()}
                >
                  {busy ? t('verifyingCode') : t('verifyCode')}
                </button>
              ) : null}
              {step === 2 && error ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p> : null}
              {step === 2 && notice ? <p className={styles.notice} role="status">{notice}</p> : null}
            </section>

            <section className={pageStyles.step} aria-labelledby="password-step-title">
              <h2 className={pageStyles.stepTitle} id="password-step-title">
                <span>3</span>
                {t('createNewPassword')}
              </h2>
              <PasswordInput
                id="new-password"
                label={t('newPassword')}
                value={newPassword}
                disabled={step !== 3 || busy}
                onChange={setNewPassword}
                showStrength={step === 3 && !passwordResetSucceeded}
              />
              <PasswordInput
                id="confirm-password"
                label={t('confirmNewPassword')}
                value={confirmPassword}
                disabled={step !== 3 || busy}
                onChange={setConfirmPassword}
              />
              <button
                className={styles.submitButton}
                type="button"
                disabled={busy || step !== 3}
                onClick={() => void handleResetPassword()}
              >
                {busy && step === 3 ? t('updatingPassword') : t('confirm')}
              </button>
              {step === 3 && error ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p> : null}
              {step === 3 && notice ? <p className={styles.notice} role="status">{notice}</p> : null}
            </section>
          </form>

          <p className={`${styles.switchPrompt} ${pageStyles.backLink}`}>
            <Link to="/login">{t('backToLogin')}</Link>
          </p>
        </section>
      </main>
    </div>
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export default ForgotPasswordPage
