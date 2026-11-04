import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Mail,
  MapPin,
  Phone,
  Send,
  Users,
} from 'lucide-react'
import {
  CONTACT_EMAIL,
  CONTACT_FANPAGE_URL,
  CONTACT_ORGANIZATION,
  CONTACT_PHONE,
  CONTACT_PHONE_LINK,
  CONTACT_SUPPORT_GROUP_URL,
} from '../../../config/contact'
import { validateContactForm, type ContactFormValues } from '../contact-validation'
import { getContactApiErrorMessage, submitContactMessage } from '../contact-api'
import { request as publicRequest } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import styles from './ContactPage.module.css'

const initialValues: ContactFormValues = {
  name: '',
  email: '',
  subject: '',
  message: '',
}

type ContactMethod = {
  label: 'supportEmail' | 'hotline' | 'officeAddress' | 'fanpage' | 'supportGroup'
  value: string
  icon: ReactNode
  href?: string
  external?: boolean
  note?: 'officialLinkNotConfigured' | 'supportLinkNotConfigured'
}

const contactMethods: ContactMethod[] = [
  {
    label: 'supportEmail',
    value: CONTACT_EMAIL,
    icon: <Mail size={20} strokeWidth={1.8} />,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    label: 'hotline',
    value: CONTACT_PHONE,
    icon: <Phone size={20} strokeWidth={1.8} />,
    href: `tel:${CONTACT_PHONE_LINK}`,
  },
  {
    label: 'officeAddress',
    value: CONTACT_ORGANIZATION,
    icon: <MapPin size={20} strokeWidth={1.8} />,
  },
  {
    label: 'fanpage',
    value: 'UTH Online Judge',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v1.8H6.8V13h2.8v8h3.9Z" />
      </svg>
    ),
    href: CONTACT_FANPAGE_URL ?? undefined,
    external: true,
    note: CONTACT_FANPAGE_URL ? undefined : 'officialLinkNotConfigured',
  },
  {
    label: 'supportGroup',
    value: 'joinStudyGroup',
    icon: <Users size={20} strokeWidth={1.8} />,
    href: CONTACT_SUPPORT_GROUP_URL ?? undefined,
    external: true,
    note: CONTACT_SUPPORT_GROUP_URL ? undefined : 'supportLinkNotConfigured',
  },
]

const formFields: Array<{
  name: keyof ContactFormValues
  label: 'contactName' | 'contactSubject' | 'contactMessage' | 'contactEmail'
  placeholder: 'enterContactName' | 'enterContactSubject' | 'enterContactMessage' | 'emailPlaceholder'
  type: 'text' | 'email' | 'textarea'
  maxLength: number
  autoComplete?: string
}> = [
  { name: 'name', label: 'contactName', placeholder: 'enterContactName', type: 'text', maxLength: 100, autoComplete: 'name' },
  { name: 'email', label: 'contactEmail', placeholder: 'emailPlaceholder', type: 'email', maxLength: 254, autoComplete: 'email' },
  { name: 'subject', label: 'contactSubject', placeholder: 'enterContactSubject', type: 'text', maxLength: 120 },
  { name: 'message', label: 'contactMessage', placeholder: 'enterContactMessage', type: 'textarea', maxLength: 2000 },
]

function ContactPage() {
  const { t } = useTranslation('pages')
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormValues, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const requestControllerRef = useRef<AbortController | null>(null)
  const { accessToken, request: authenticatedRequest } = useAuth()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestControllerRef.current?.abort()
    }
  }, [])
  const errors = validateContactForm(values)

  function updateField(name: keyof ContactFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setNotice('')
    setNoticeIsError(false)
  }

  function handleBlur(name: keyof ContactFormValues) {
    setTouched((current) => ({ ...current, [name]: true }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlightRef.current) return
    setSubmitted(true)
    setTouched({ name: true, email: true, subject: true, message: true })

    if (Object.keys(errors).length > 0) return

    inFlightRef.current = true
    const controller = new AbortController()
    requestControllerRef.current = controller
    setIsSubmitting(true)
    setNotice('')
    setNoticeIsError(false)
    try {
      const response = await submitContactMessage(
        accessToken ? authenticatedRequest : publicRequest,
        {
          fullName: values.name.trim(),
          email: values.email.trim(),
          subject: values.subject.trim(),
          content: values.message.trim(),
        },
        controller.signal,
      )
      if (!mountedRef.current) return
      setValues(initialValues)
      setTouched({})
      setSubmitted(false)
      setNotice(response.trackingAvailable
        ? t('contactSuccess')
        : t('contactSuccessUntracked'))
    } catch (error) {
      if (mountedRef.current) {
        setNotice(getContactApiErrorMessage(error, t('contactSubmitError')))
        setNoticeIsError(true)
      }
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setIsSubmitting(false)
    }
  }

  function getVisibleError(name: keyof ContactFormValues): string | undefined {
    return submitted || touched[name] ? errors[name] : undefined
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <h1 className={styles.visuallyHidden}>{t('contactPage')}</h1>
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <section className={`${styles.card} ${styles.aboutCard}`} aria-labelledby="contact-about-title">
              <div className={styles.brandHeading}>
                <span className={styles.brandMark} aria-hidden="true">UTH</span>
                <div>
                  <h2 id="contact-about-title">UTH Online Judge</h2>
                  <p>{t('contactCommunitySubtitle')}</p>
                </div>
              </div>
              <p className={styles.aboutDescription}>
                {t('contactCommunityDescription')}
              </p>
            </section>

            <section className={`${styles.card} ${styles.contactCard}`} aria-labelledby="contact-details-title">
              <h2 id="contact-details-title">{t('contactDetails')}</h2>
              <ul className={styles.contactList}>
                {contactMethods.map(({ label, value, icon, href, external, note }) => (
                  <li className={styles.contactItem} key={label}>
                    <span className={styles.contactIcon} aria-hidden="true">{icon}</span>
                    <div className={styles.contactText}>
                      <span className={styles.contactLabel}>{t(label)}</span>
                      {href ? (
                        <a
                          className={styles.contactValue}
                          href={href}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                        >
                          {label === 'supportGroup' ? t('joinStudyGroup') : value}
                        </a>
                      ) : (
                        <span className={styles.contactValue}>{value}</span>
                      )}
                        {note && <span className={styles.contactNote}>{t(note)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${styles.card} ${styles.formCard}`} aria-labelledby="contact-form-title">
            <div className={styles.formHeading}>
              <span className={styles.formIcon} aria-hidden="true">
                <Send size={20} />
              </span>
              <div>
                <h2 id="contact-form-title">{t('contactMessageTitle')}</h2>
                <p>{t('contactMessageDescription')}</p>
              </div>
            </div>

            <form className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
              {formFields.map(({ name, label, placeholder, type, maxLength, autoComplete }) => {
                const errorKey = getVisibleError(name)
                const error = errorKey ? t(errorKey) : undefined
                const fieldId = `contact-${name}`
                const errorId = `${fieldId}-error`
                const describedBy = error ? errorId : undefined

                return (
                  <div className={styles.field} key={name}>
                    <label htmlFor={fieldId}>
                      {t(label)} <span aria-hidden="true">*</span>
                    </label>
                    {type === 'textarea' ? (
                      <textarea
                        id={fieldId}
                        name={name}
                        value={values[name]}
                        placeholder={t(placeholder)}
                        maxLength={maxLength}
                        rows={5}
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy}
                        onChange={(event) => updateField(name, event.target.value)}
                        onBlur={() => handleBlur(name)}
                      />
                    ) : (
                      <input
                        id={fieldId}
                        name={name}
                        type={type}
                        value={values[name]}
                        placeholder={t(placeholder)}
                        maxLength={maxLength}
                        autoComplete={autoComplete}
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy}
                        onChange={(event) => updateField(name, event.target.value)}
                        onBlur={() => handleBlur(name)}
                      />
                    )}
                    <div className={styles.fieldMeta}>
                      {error ? (
                        <span className={styles.fieldError} id={errorId} role="alert">{error}</span>
                      ) : <span aria-hidden="true" />}
                      {name === 'message' && (
                        <span className={styles.counter}>{t('characterCount', { count: values.message.length, max: 2000 })}</span>
                      )}
                    </div>
                  </div>
                )
              })}

              <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
                <Send size={17} aria-hidden="true" />
                {isSubmitting ? t('sending') : t('sendContact')}
              </button>
              {notice && (
                <p className={styles.notice} role={noticeIsError ? 'alert' : 'status'} aria-live={noticeIsError ? 'assertive' : 'polite'}>
                  {notice}
                </p>
              )}
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}

export default ContactPage
