import { useState } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import { RequireAuth } from '../../auth/components/RequireAuth'
import { useAuth } from '../../auth/useAuth'
import { describeError, formatDate, useAdminQuery } from '../../admin/api'
import { Badge, Notice } from '../../admin/components'
import styles from '../../admin/admin.module.css'

type Ticket = { id: string; subject: string; message: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'; adminReply: string | null; createdAt: string }
const label = { OPEN: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng' } as const

function SupportContent() {
  const { request } = useAuth()
  const tickets = useAdminQuery<Ticket[]>('/api/support/tickets')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError('')
    setMessage('')
    try {
      await request('/api/support/tickets', { method: 'POST', body: JSON.stringify({ subject: subject.trim(), message: text.trim() }) })
      setSubject('')
      setText('')
      setMessage('Đã gửi yêu cầu. Chúng tôi sẽ phản hồi sớm nhất.')
      tickets.reload()
    } catch (reason) {
      setError(describeError(reason))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.shell} style={{ gridTemplateColumns: '1fr' }}>
      <main className={styles.content} style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <h1 className={styles.title}>Hỗ trợ kỹ thuật</h1>
        <p className={styles.subtitle}>Gặp sự cố khi dùng hệ thống? Gửi yêu cầu cho quản trị viên.</p>
        <Notice kind="error">{error || tickets.error}</Notice>
        <Notice kind="success">{message}</Notice>
        <form className={styles.card} onSubmit={(event) => void submit(event)}>
          <label className={styles.field}>Tiêu đề<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={200} required /></label>
          <label className={styles.field} style={{ margin: '12px 0' }}>Mô tả sự cố<textarea value={text} onChange={(event) => setText(event.target.value)} minLength={5} maxLength={4000} required /></label>
          <button className={styles.btn} type="submit" disabled={sending}>{sending ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
        </form>
        <section className={styles.card}>
          <h3>Yêu cầu của bạn</h3>
          {tickets.data?.length === 0 && <p className={styles.muted}>Bạn chưa gửi yêu cầu nào.</p>}
          {tickets.data?.map((ticket) => (
            <article key={ticket.id} style={{ borderTop: '1px solid #e6eeee', padding: '10px 0' }}>
              <b>{ticket.subject}</b> <Badge tone={ticket.status === 'RESOLVED' ? 'green' : ticket.status === 'CLOSED' ? 'gray' : 'amber'}>{label[ticket.status]}</Badge>
              <div className={styles.muted}>{formatDate(ticket.createdAt)}</div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
              {ticket.adminReply && <p className={styles.success}><b>Phản hồi:</b> {ticket.adminReply}</p>}
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <RequireAuth><SupportContent /></RequireAuth>
    </div>
  )
}
