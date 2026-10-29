import { useState, type FormEvent } from 'react'
import { CONTACT_EMAIL, CONTACT_ORGANIZATION } from '../../../config/contact'
import styles from './ContactPage.module.css'

const FANPAGE_URL = 'https://www.facebook.com/profile.php?id=61595822645452'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const channels = [
  { icon: '✉', label: 'Email hỗ trợ', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { icon: '☎', label: 'Hotline', value: '+84 94 8811 592', href: 'tel:+84948811592' },
  { icon: '⌂', label: 'Địa chỉ cơ sở', value: CONTACT_ORGANIZATION },
  { icon: 'f', label: 'Facebook Fanpage', value: 'UTH Online Judge', href: FANPAGE_URL },
  { icon: '✈', label: 'Nhóm Zalo / Telegram hỗ trợ', value: 'Tham gia nhóm học tập', href: 'https://zalo.me/' },
]

interface FormState {
  name: string
  email: string
  subject: string
  message: string
}

const emptyForm: FormState = { name: '', email: '', subject: '', message: '' }

function ContactPage() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [sent, setSent] = useState(false)

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSent(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) next.name = 'Vui lòng nhập họ tên.'
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Email không hợp lệ.'
    if (!form.subject.trim()) next.subject = 'Vui lòng nhập tiêu đề.'
    if (form.message.trim().length < 10) next.message = 'Nội dung tối thiểu 10 ký tự.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // Dự án chưa có API nhận liên hệ, nên mở ứng dụng email với nội dung đã điền sẵn.
    const body = `Họ tên: ${form.name.trim()}\nEmail: ${form.email.trim()}\n\n${form.message.trim()}`
    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(form.subject.trim())}&body=${encodeURIComponent(body)}`
    setSent(true)
    setForm(emptyForm)
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.hero}>
          <h1>Liên hệ</h1>
          <p>Cần hỗ trợ về bài tập, tài khoản hay muốn báo lỗi? Hãy liên hệ với đội ngũ UTH Online Judge.</p>
        </header>

        <div className={styles.grid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <div className={styles.fanpage}>
                <span className={styles.fanpageLogo} aria-hidden="true">UTH</span>
                <div>
                  <h2>UTH Online Judge</h2>
                  <p>Fanpage chính thức · Cộng đồng lập trình UTH</p>
                </div>
              </div>
              <p className={styles.muted}>
                Theo dõi fanpage để cập nhật kỳ thi, bài tập mới và thông báo bảo trì hệ thống.
              </p>
              <a className={styles.primaryLink} href={FANPAGE_URL} target="_blank" rel="noreferrer">
                Mở Facebook Fanpage ↗
              </a>
            </section>

            <section className={styles.card}>
              <h2>Thông tin liên hệ</h2>
              <ul className={styles.channels}>
                {channels.map((channel) => (
                  <li key={channel.label}>
                    <span className={styles.channelIcon} aria-hidden="true">{channel.icon}</span>
                    <span>
                      <small>{channel.label}</small>
                      {channel.href ? (
                        <a
                          href={channel.href}
                          {...(channel.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                        >
                          {channel.value}
                        </a>
                      ) : (
                        <strong>{channel.value}</strong>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={styles.card}>
            <h2>Gửi tin nhắn cho chúng tôi</h2>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <label>
                Họ và tên
                <input value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="name" />
                {errors.name && <span className={styles.error}>{errors.name}</span>}
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" />
                {errors.email && <span className={styles.error}>{errors.email}</span>}
              </label>
              <label>
                Tiêu đề
                <input value={form.subject} onChange={(e) => update('subject', e.target.value)} />
                {errors.subject && <span className={styles.error}>{errors.subject}</span>}
              </label>
              <label>
                Nội dung cần hỗ trợ
                <textarea rows={6} value={form.message} onChange={(e) => update('message', e.target.value)} />
                {errors.message && <span className={styles.error}>{errors.message}</span>}
              </label>
              <button type="submit" className={styles.submit}>Gửi liên hệ</button>
              {sent && (
                <p className={styles.success} role="status">
                  ✓ Đã tạo email gửi tới {CONTACT_EMAIL}. Vui lòng bấm Gửi trong ứng dụng email để hoàn tất.
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
