import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, KeyRound, X } from 'lucide-react'
import { ApiError } from '../../features/auth/api'
import PasswordStrengthMeter from '../../features/auth/components/PasswordStrengthMeter'
import { useAuth } from '../../features/auth/useAuth'
import styles from './ChangePasswordDialog.module.css'

type ChangePasswordDialogProps = {
  onClose: () => void
  onSuccess: () => void
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword'
type PasswordValues = Record<PasswordField, string>
type PasswordErrors = Partial<Record<PasswordField, string>>

const fieldLabels: Record<PasswordField, string> = {
  currentPassword: 'Mật khẩu hiện tại',
  newPassword: 'Mật khẩu mới',
  confirmPassword: 'Xác nhận mật khẩu mới',
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function ChangePasswordDialog({ onClose, onSuccess }: ChangePasswordDialogProps) {
  const { changePassword, completePasswordSetup, request } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)
  const currentPasswordRef = useRef<HTMLInputElement>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const suppressPasswordSetupAutofocus = useRef(false)
  const otpRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<PasswordValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [visibleFields, setVisibleFields] = useState<Set<PasswordField>>(() => new Set())
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [setupStep, setSetupStep] = useState<'password' | 'otp'>('password')
  const [transactionId, setTransactionId] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [otp, setOtp] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [newPasswordMeterVisible, setNewPasswordMeterVisible] = useState(false)
  const [newPasswordFocused, setNewPasswordFocused] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    let active = true
    void request<{ hasPassword: boolean }>('/auth/me/password-status')
      .then((status) => {
        if (active) setHasPassword(status.hasPassword)
      })
      .catch((error: unknown) => {
        if (!active) return
        setRequestError(
          error instanceof Error
            ? error.message
            : 'Không thể kiểm tra trạng thái mật khẩu. Vui lòng thử lại.',
        )
      })
      .finally(() => {
        if (active) setStatusLoading(false)
      })
    return () => {
      active = false
    }
  }, [request, statusAttempt])

  useEffect(() => {
    if (hasPassword === true) currentPasswordRef.current?.focus()
    else if (hasPassword === false && setupStep === 'password') {
      const input = newPasswordRef.current
      if (input && document.activeElement !== input) {
        suppressPasswordSetupAutofocus.current = true
        input.focus()
      }
    }
    else if (hasPassword === false && setupStep === 'otp') otpRef.current?.focus()
  }, [hasPassword, setupStep])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setTimeout(
      () => setCooldownSeconds((current) => Math.max(0, current - 1)),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [cooldownSeconds])

  function close() {
    if (!isSubmitting) onClose()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isSubmitting) {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    )
    if (!controls?.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function validateChange(): PasswordErrors {
    const nextErrors: PasswordErrors = {}
    if (!values.currentPassword) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.'
    }
    validateNewPassword(nextErrors)
    if (values.newPassword && values.currentPassword === values.newPassword) {
      nextErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    }
    return nextErrors
  }

  function validateSetup(): PasswordErrors {
    const nextErrors: PasswordErrors = {}
    validateNewPassword(nextErrors)
    return nextErrors
  }

  function validateNewPassword(nextErrors: PasswordErrors) {
    if (!values.newPassword) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới.'
    } else if (values.newPassword.length < 8) {
      nextErrors.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự.'
    } else if (values.newPassword.length > 72 || utf8ByteLength(values.newPassword) > 72) {
      nextErrors.newPassword = 'Mật khẩu mới không được vượt quá 72 ký tự hoặc 72 byte.'
    }
    if (!values.confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.'
    } else if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.'
    }
  }

  function toggleVisibility(field: PasswordField) {
    setVisibleFields((current) => {
      const next = new Set(current)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  function updateValue(field: PasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setRequestError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || hasPassword === null) return

    setRequestError('')
    const validationErrors = hasPassword
      ? validateChange()
      : setupStep === 'password'
        ? validateSetup()
        : {}
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    let completed = false
    try {
      if (hasPassword) {
        await changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        completed = true
      } else if (setupStep === 'password') {
        const response = await request<{
          transactionId: string
          retryAfterSeconds: number
        }>('/auth/me/password-setup/otp', { method: 'POST' })
        setTransactionId(response.transactionId)
        setCooldownSeconds(response.retryAfterSeconds)
        setSetupToken('')
        setOtp('')
        setSetupStep('otp')
      } else if (setupToken) {
        await completePasswordSetup({ setupToken, newPassword: values.newPassword })
        completed = true
      } else if (transactionId) {
        const result = await request<{ setupToken: string }>(
          '/auth/me/password-setup/verify-otp',
          {
            method: 'POST',
            body: JSON.stringify({ transactionId, otp }),
          },
        )
        setSetupToken(result.setupToken)
        await completePasswordSetup({
          setupToken: result.setupToken,
          newPassword: values.newPassword,
        })
        completed = true
      } else {
        setRequestError('Giao dịch xác minh không còn hợp lệ. Vui lòng gửi lại mã.')
      }
    } catch (error) {
      if (error instanceof ApiError) setRequestError(error.message)
      else {
        setRequestError(
          hasPassword
            ? 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.'
            : 'Không thể thiết lập mật khẩu lúc này. Vui lòng thử lại sau.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
    if (completed) onSuccess()
  }

  async function resendOtp() {
    if (isSubmitting || cooldownSeconds > 0) return
    setIsSubmitting(true)
    setRequestError('')
    try {
      const response = await request<{
        transactionId: string
        retryAfterSeconds: number
      }>('/auth/me/password-setup/otp', { method: 'POST' })
      setTransactionId(response.transactionId)
      setSetupToken('')
      setOtp('')
      setCooldownSeconds(response.retryAfterSeconds)
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi lại mã xác minh. Vui lòng thử lại sau.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderPasswordField(field: PasswordField, autoComplete: string) {
    const label = fieldLabels[field]
    const errorId = `${field}-error`
    const strengthId = `${field}-strength`
    const showStrength = field === 'newPassword'
    const meterVisible = showStrength
      && newPasswordMeterVisible
      && (newPasswordFocused || values.newPassword.length > 0)
    return (
      <div className={styles.field} key={field}>
        <label htmlFor={field}>{label} <span aria-hidden="true">*</span></label>
        <div className={`${styles.inputWrap} ${errors[field] ? styles.inputInvalid : ''}`}>
          <input
            ref={
              field === 'currentPassword'
                ? currentPasswordRef
                : field === 'newPassword'
                  ? newPasswordRef
                  : undefined
            }
            id={field}
            name={field}
            type={visibleFields.has(field) ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={values[field]}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={[
              errors[field] ? errorId : null,
              meterVisible ? strengthId : null,
            ].filter(Boolean).join(' ') || undefined}
            onChange={(event) => updateValue(field, event.target.value)}
            onFocus={showStrength ? (event) => {
              if (suppressPasswordSetupAutofocus.current) {
                suppressPasswordSetupAutofocus.current = false
                return
              }
              updateValue(field, event.currentTarget.value)
              setNewPasswordFocused(true)
              setNewPasswordMeterVisible(true)
            } : undefined}
            onPointerDown={showStrength ? (event) => {
              setNewPasswordMeterVisible(true)
              if (document.activeElement === event.currentTarget) {
                setNewPasswordFocused(true)
              }
            } : undefined}
            onKeyDown={showStrength ? (event) => {
              if (event.key !== 'Tab' && (
                event.key.length === 1
                || event.key === 'Backspace'
                || event.key === 'Delete'
              )) {
                setNewPasswordFocused(true)
                setNewPasswordMeterVisible(true)
              }
            } : undefined}
            onBlur={showStrength ? (event) => {
              setNewPasswordFocused(false)
              if (!event.currentTarget.value) setNewPasswordMeterVisible(false)
            } : undefined}
            disabled={isSubmitting}
          />
          <button
            className={styles.visibilityButton}
            type="button"
            aria-label={`${visibleFields.has(field) ? 'Ẩn' : 'Hiện'} ${label.toLocaleLowerCase('vi')}`}
            aria-pressed={visibleFields.has(field)}
            onClick={() => toggleVisibility(field)}
            disabled={isSubmitting}
          >
            {visibleFields.has(field)
              ? <EyeOff size={18} aria-hidden="true" />
              : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {errors[field] && <p className={styles.fieldError} id={errorId} role="alert">{errors[field]}</p>}
        {meterVisible ? <PasswordStrengthMeter id={strengthId} password={values[field]} /> : null}
      </div>
    )
  }

  const isSetup = hasPassword === false
  const title = hasPassword === null
    ? 'Quản lý mật khẩu'
    : isSetup
      ? 'Thiết lập mật khẩu'
      : 'Đổi mật khẩu'
  const description = isSetup
    ? 'Bạn đang sử dụng Google hoặc GitHub để đăng nhập. Hãy thiết lập mật khẩu để có thể đăng nhập bằng email và mật khẩu.'
    : 'Bảo vệ tài khoản bằng mật khẩu mới.'

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        aria-describedby="change-password-description"
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <span className={styles.headerIcon}><KeyRound size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="change-password-title">{title}</h2>
            <p id="change-password-description">{description}</p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label="Đóng hộp thoại"
            onClick={close}
            disabled={isSubmitting}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className={styles.form} onSubmit={submit} noValidate>
          {statusLoading && hasPassword === null ? (
            <p className={styles.statusMessage} role="status">Đang kiểm tra trạng thái mật khẩu…</p>
          ) : hasPassword === null ? (
            <>
              <p className={styles.requestError} role="alert">{requestError}</p>
              <div className={styles.actions}>
                <button className={styles.cancelButton} type="button" onClick={close}>Hủy</button>
                <button
                  className={styles.submitButton}
                  type="button"
                  onClick={() => {
                    setRequestError('')
                    setStatusLoading(true)
                    setStatusAttempt((attempt) => attempt + 1)
                  }}
                  disabled={statusLoading}
                >
                  {statusLoading ? 'Đang kiểm tra…' : 'Thử lại'}
                </button>
              </div>
            </>
          ) : hasPassword ? (
            <>
              {renderPasswordField('currentPassword', 'current-password')}
              {renderPasswordField('newPassword', 'new-password')}
              {renderPasswordField('confirmPassword', 'new-password')}
              <p className={styles.passwordHint}>Mật khẩu mới cần có ít nhất 8 ký tự và tối đa 72 byte.</p>
              {requestError && <p className={styles.requestError} role="alert">{requestError}</p>}
              <div className={styles.actions}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={close}
                  disabled={isSubmitting}
                >
                  Hủy
                </button>
                <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Đang xử lý…
                    </>
                  ) : 'Đổi mật khẩu'}
                </button>
              </div>
            </>
          ) : setupStep === 'password' ? (
            <>
              {renderPasswordField('newPassword', 'new-password')}
              {renderPasswordField('confirmPassword', 'new-password')}
              <p className={styles.passwordHint}>Mật khẩu mới cần có ít nhất 8 ký tự và tối đa 72 byte.</p>
              {requestError && <p className={styles.requestError} role="alert">{requestError}</p>}
              <div className={styles.actions}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={close}
                  disabled={isSubmitting}
                >
                  Hủy
                </button>
                <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Đang gửi mã…
                    </>
                  ) : 'Tiếp tục xác minh email'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.passwordHint}>
                Nhập mã 6 chữ số đã gửi đến email liên kết với tài khoản để xác minh quyền sở hữu.
              </p>
              <div className={styles.field}>
                <label htmlFor="password-setup-otp">Mã xác minh <span aria-hidden="true">*</span></label>
                <div className={`${styles.inputWrap} ${requestError ? styles.inputInvalid : ''}`}>
                  <input
                    ref={otpRef}
                    id="password-setup-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    aria-label="Mã xác minh gồm 6 chữ số"
                    aria-invalid={Boolean(requestError)}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                      setRequestError('')
                    }}
                    disabled={isSubmitting || Boolean(setupToken)}
                  />
                </div>
              </div>
              <p className={styles.statusMessage} role="status" aria-live="polite">
                {cooldownSeconds > 0
                  ? `Bạn có thể gửi lại mã sau ${cooldownSeconds} giây.`
                  : 'Bạn có thể yêu cầu gửi lại mã xác minh.'}
              </p>
              {requestError && <p className={styles.requestError} role="alert">{requestError}</p>}
              <div className={styles.actions}>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={close}
                  disabled={isSubmitting}
                >
                  Hủy
                </button>
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={() => void resendOtp()}
                  disabled={isSubmitting || cooldownSeconds > 0}
                >
                  Gửi lại mã
                </button>
                <button
                  className={styles.submitButton}
                  type="submit"
                  disabled={isSubmitting || (!setupToken && otp.length !== 6)}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Đang xác minh…
                    </>
                  ) : setupToken ? 'Thử lại thiết lập mật khẩu' : 'Xác minh và thiết lập'}
                </button>
              </div>
            </>
          )}
        </form>
      </section>
    </div>,
    document.body,
  )
}

export default ChangePasswordDialog
