import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buildLoginPath } from '../../auth/return-path'
import { useAuth } from '../../auth/useAuth'
import styles from '../../problems/components/ReportModal.module.css'
import {
  REQUEST_LIMITS,
  classifyRequestError,
  submitOrganizationRequest,
  toRequestInput,
  validateRequestField,
  type RequestFormValues,
} from '../organizations-api'

type FieldName = keyof RequestFormValues

const fields: Array<{ name: FieldName; labelKey: string }> = [
  { name: 'fullName', labelKey: 'organizationRequestFullName' },
  { name: 'workplace', labelKey: 'organizationRequestWorkplace' },
  { name: 'position', labelKey: 'organizationRequestPosition' },
  { name: 'phone', labelKey: 'organizationRequestPhone' },
  { name: 'wish', labelKey: 'organizationRequestWish' },
]

const emptyValues: RequestFormValues = { fullName: '', workplace: '', position: '', wish: '', phone: '' }

function OrganizationRequestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('pages')
  const { user, request } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState(emptyValues)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const inFlightRef = useRef(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function validate(name: FieldName, label: string): string {
    const result = validateRequestField(name, values[name])
    if (result === 'required') return t('organizationRequestRequired', { field: label.toLocaleLowerCase() })
    if (result === 'phoneInvalid') return t('organizationRequestPhoneInvalid')
    return ''
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (inFlightRef.current) return
    setTouched({ fullName: true, workplace: true, position: true, wish: true, phone: true })
    if (fields.some(({ name }) => validateRequestField(name, values[name]) !== null)) return
    inFlightRef.current = true
    setSubmitting(true)
    setError('')
    try {
      await submitOrganizationRequest(request, toRequestInput(values))
      setSubmitted(true)
    } catch (caught) {
      setError(t(`organizationRequestError_${classifyRequestError(caught)}`))
    } finally {
      inFlightRef.current = false
      setSubmitting(false)
    }
  }

  const loginPath = buildLoginPath(`${location.pathname}${location.search}`)

  return createPortal(
    <div className={`${styles.backdrop} ${styles.backdropOverlay}`} onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`${styles.dialog} ${styles.dialogScrollable}`} role="dialog" aria-modal="true" aria-labelledby="organization-request-title">
        <h2 id="organization-request-title">{t('organizationRequestTitle')}</h2>
        {submitted ? (
          <>
            <p className={styles.success} role="status">{t('organizationRequestSuccess')}</p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={onClose}>{t('organizationRequestClose')}</button>
            </div>
          </>
        ) : !user ? (
          <>
            <p className={styles.notice} role="status">{t('organizationRequestLoginHint')}</p>
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>{t('organizationRequestCancel')}</button>
              <Link className={styles.primary} to={loginPath}>{t('organizationRequestLogin')}</Link>
            </div>
          </>
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <p className={styles.notice}>{t('organizationRequestIntro')}</p>
            {fields.map(({ name, labelKey }) => {
              const label = t(labelKey)
              const message = touched[name] ? validate(name, label) : ''
              const id = `organization-request-${name}`
              const shared = {
                id,
                value: values[name],
                maxLength: REQUEST_LIMITS[name],
                required: true,
                disabled: submitting,
                'aria-invalid': message ? true : undefined,
                'aria-describedby': message ? `${id}-error` : undefined,
                onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
                onChange: (event: { target: { value: string } }) =>
                  setValues((current) => ({ ...current, [name]: event.target.value })),
              } as const
              return (
                <div key={name}>
                  <label htmlFor={id}>{label}</label>
                  {name === 'wish'
                    ? <textarea {...shared} rows={4} />
                    : <input {...shared} type={name === 'phone' ? 'tel' : 'text'} autoComplete={name === 'phone' ? 'tel' : 'off'} />}
                  {message && <p id={`${id}-error`} className={styles.fieldError} role="alert">{message}</p>}
                </div>
              )
            })}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>{t('organizationRequestCancel')}</button>
              <button className={styles.primary} type="submit" disabled={submitting}>
                {submitting ? t('organizationRequestSubmitting') : t('organizationRequestSubmit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default OrganizationRequestModal
