import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, KeyRound, X } from 'lucide-react'
import { ApiError } from '../../features/auth/api'
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
  const { changePassword } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)
  const currentPasswordRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<PasswordValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [visibleFields, setVisibleFields] = useState<Set<PasswordField>>(() => new Set())
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [requestError, setRequestError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    currentPasswordRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

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

  function validate(): PasswordErrors {
    const nextErrors: PasswordErrors = {}
    if (!values.currentPassword) {
      nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.'
    }
    if (!values.newPassword) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới.'
    } else if (values.newPassword.length < 8) {
      nextErrors.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự.'
    } else if (values.newPassword.length > 72 || utf8ByteLength(values.newPassword) > 72) {
      nextErrors.newPassword = 'Mật khẩu mới không được vượt quá 72 ký tự hoặc 72 byte.'
    } else if (values.currentPassword === values.newPassword) {
      nextErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    }
    if (!values.confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.'
    } else if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.'
    }
    return nextErrors
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
    if (isSubmitting) return

    const validationErrors = validate()
    setErrors(validationErrors)
    setRequestError('')
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setIsSubmitting(false)
      onSuccess()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 && error.message.includes('Mật khẩu hiện tại')) {
          setErrors((current) => ({ ...current, currentPassword: error.message }))
        } else if (error.status === 400 && error.message.includes('Mật khẩu mới')) {
          setErrors((current) => ({ ...current, newPassword: error.message }))
        } else {
          setRequestError(error.message)
        }
      } else {
        setRequestError('Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.')
      }
      setIsSubmitting(false)
    }
  }

  function renderPasswordField(field: PasswordField, autoComplete: string) {
    const label = fieldLabels[field]
    const errorId = `${field}-error`
    return (
      <div className={styles.field} key={field}>
        <label htmlFor={field}>{label} <span aria-hidden="true">*</span></label>
        <div className={`${styles.inputWrap} ${errors[field] ? styles.inputInvalid : ''}`}>
          <input
            ref={field === 'currentPassword' ? currentPasswordRef : undefined}
            id={field}
            name={field}
            type={visibleFields.has(field) ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={values[field]}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={errors[field] ? errorId : undefined}
            onChange={(event) => updateValue(field, event.target.value)}
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
      </div>
    )
  }

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
            <h2 id="change-password-title">Đổi mật khẩu</h2>
            <p id="change-password-description">Bảo vệ tài khoản bằng mật khẩu mới.</p>
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
        </form>
      </section>
    </div>,
    document.body,
  )
}

export default ChangePasswordDialog
