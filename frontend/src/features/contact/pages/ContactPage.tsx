import { useState, type FormEvent, type ReactNode } from 'react'
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
import styles from './ContactPage.module.css'

const initialValues: ContactFormValues = {
  name: '',
  email: '',
  subject: '',
  message: '',
}

type ContactMethod = {
  label: string
  value: string
  icon: ReactNode
  href?: string
  external?: boolean
  note?: string
}

const contactMethods: ContactMethod[] = [
  {
    label: 'Email hỗ trợ',
    value: CONTACT_EMAIL,
    icon: <Mail size={20} strokeWidth={1.8} />,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    label: 'Hotline',
    value: CONTACT_PHONE,
    icon: <Phone size={20} strokeWidth={1.8} />,
    href: `tel:${CONTACT_PHONE_LINK}`,
  },
  {
    label: 'Địa chỉ cơ sở',
    value: CONTACT_ORGANIZATION,
    icon: <MapPin size={20} strokeWidth={1.8} />,
  },
  {
    label: 'Facebook Fanpage',
    value: 'UTH Online Judge',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v1.8H6.8V13h2.8v8h3.9Z" />
      </svg>
    ),
    href: CONTACT_FANPAGE_URL ?? undefined,
    external: true,
    note: CONTACT_FANPAGE_URL ? undefined : 'Liên kết chính thức chưa được cấu hình.',
  },
  {
    label: 'Nhóm Zalo / Telegram hỗ trợ',
    value: 'Tham gia nhóm học tập',
    icon: <Users size={20} strokeWidth={1.8} />,
    href: CONTACT_SUPPORT_GROUP_URL ?? undefined,
    external: true,
    note: CONTACT_SUPPORT_GROUP_URL ? undefined : 'Liên kết nhóm hỗ trợ chưa được cấu hình.',
  },
]

const formFields: Array<{
  name: keyof ContactFormValues
  label: string
  placeholder: string
  type: 'text' | 'email' | 'textarea'
  maxLength: number
  autoComplete?: string
}> = [
  { name: 'name', label: 'Họ và tên', placeholder: 'Nhập họ và tên của bạn', type: 'text', maxLength: 100, autoComplete: 'name' },
  { name: 'email', label: 'Email', placeholder: 'ban@example.com', type: 'email', maxLength: 254, autoComplete: 'email' },
  { name: 'subject', label: 'Tiêu đề', placeholder: 'Bạn cần hỗ trợ vấn đề gì?', type: 'text', maxLength: 120 },
  { name: 'message', label: 'Nội dung cần hỗ trợ', placeholder: 'Mô tả chi tiết vấn đề bạn đang gặp phải...', type: 'textarea', maxLength: 2000 },
]

function ContactPage() {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormValues, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState('')
  const errors = validateContactForm(values)

  function updateField(name: keyof ContactFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setNotice('')
  }

  function handleBlur(name: keyof ContactFormValues) {
    setTouched((current) => ({ ...current, [name]: true }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setTouched({ name: true, email: true, subject: true, message: true })

    if (Object.keys(errors).length > 0) return

    setNotice('Chức năng gửi liên hệ đang được phát triển. Vui lòng liên hệ qua email hoặc hotline.')
  }

  function getVisibleError(name: keyof ContactFormValues): string | undefined {
    return submitted || touched[name] ? errors[name] : undefined
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <h1 className={styles.visuallyHidden}>Liên hệ</h1>
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <section className={`${styles.card} ${styles.aboutCard}`} aria-labelledby="contact-about-title">
              <div className={styles.brandHeading}>
                <span className={styles.brandMark} aria-hidden="true">UTH</span>
                <div>
                  <h2 id="contact-about-title">UTH Online Judge</h2>
                  <p>Fanpage chính thức · Cộng đồng lập trình UTH</p>
                </div>
              </div>
              <p className={styles.aboutDescription}>
                Theo dõi fanpage để cập nhật kỳ thi, bài tập mới và thông báo bảo trì hệ thống.
              </p>
            </section>

            <section className={`${styles.card} ${styles.contactCard}`} aria-labelledby="contact-details-title">
              <h2 id="contact-details-title">Thông tin liên hệ</h2>
              <ul className={styles.contactList}>
                {contactMethods.map(({ label, value, icon, href, external, note }) => (
                  <li className={styles.contactItem} key={label}>
                    <span className={styles.contactIcon} aria-hidden="true">{icon}</span>
                    <div className={styles.contactText}>
                      <span className={styles.contactLabel}>{label}</span>
                      {href ? (
                        <a
                          className={styles.contactValue}
                          href={href}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                        >
                          {value}
                        </a>
                      ) : (
                        <span className={styles.contactValue}>{value}</span>
                      )}
                      {note && <span className={styles.contactNote}>{note}</span>}
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
                <h2 id="contact-form-title">Gửi tin nhắn cho chúng tôi</h2>
                <p>Để lại thông tin, đội ngũ sẽ tiếp nhận yêu cầu của bạn.</p>
              </div>
            </div>

            <form className={styles.form} noValidate onSubmit={handleSubmit}>
              {formFields.map(({ name, label, placeholder, type, maxLength, autoComplete }) => {
                const error = getVisibleError(name)
                const fieldId = `contact-${name}`
                const errorId = `${fieldId}-error`
                const describedBy = error ? errorId : undefined

                return (
                  <div className={styles.field} key={name}>
                    <label htmlFor={fieldId}>
                      {label} <span aria-hidden="true">*</span>
                    </label>
                    {type === 'textarea' ? (
                      <textarea
                        id={fieldId}
                        name={name}
                        value={values[name]}
                        placeholder={placeholder}
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
                        placeholder={placeholder}
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
                        <span className={styles.counter}>{values.message.length}/2000</span>
                      )}
                    </div>
                  </div>
                )
              })}

              <button className={styles.submitButton} type="submit">
                <Send size={17} aria-hidden="true" />
                Gửi liên hệ
              </button>
              {notice && <p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}

export default ContactPage
