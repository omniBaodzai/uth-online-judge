import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Badge, Modal, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type Ticket = { id: string; username: string; email: string; subject: string; message: string; status: Status; priority: Priority; adminReply: string | null; createdAt: string }
const statusLabel: Record<Status, string> = { OPEN: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng' }
const statusTone = { OPEN: 'red', IN_PROGRESS: 'amber', RESOLVED: 'green', CLOSED: 'gray' } as const
const priorityLabel: Record<Priority, string> = { LOW: 'Thấp', NORMAL: 'Thường', HIGH: 'Cao', URGENT: 'Khẩn cấp' }

function TicketModal({ ticket, onClose, onSaved }: { ticket: Ticket; onClose: () => void; onSaved: () => void }) {
  const { request } = useAuth()
  const [status, setStatus] = useState<Status>(ticket.status)
  const [priority, setPriority] = useState<Priority>(ticket.priority)
  const [reply, setReply] = useState(ticket.adminReply ?? '')
  const [error, setError] = useState('')

  async function save() {
    try {
      await request(`/api/admin/tickets/${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ status, priority, reply: reply.trim() || undefined }) })
      onSaved()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  return (
    <Modal title={ticket.subject} onClose={onClose}>
      <Notice kind="error">{error}</Notice>
      <p className={styles.muted}>{ticket.username} ({ticket.email}) · {formatDate(ticket.createdAt)}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
      <div className={styles.formGrid}>
        <label className={styles.field}>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as Status)}>{(Object.keys(statusLabel) as Status[]).map((value) => <option key={value} value={value}>{statusLabel[value]}</option>)}</select></label>
        <label className={styles.field}>Mức ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{(Object.keys(priorityLabel) as Priority[]).map((value) => <option key={value} value={value}>{priorityLabel[value]}</option>)}</select></label>
      </div>
      <label className={styles.field} style={{ margin: '12px 0' }}>Phản hồi gửi người dùng<textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={4000} /></label>
      <button type="button" className={styles.btn} onClick={() => void save()}>Lưu</button>
    </Modal>
  )
}

export default function AdminSupportPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Ticket | null>(null)
  const [message, setMessage] = useState('')
  const list = useAdminQuery<Paged<Ticket>>(`/api/admin/tickets${buildQuery({ status, page, pageSize: 15 })}`)
  return (
    <AdminLayout title="Hỗ trợ kỹ thuật" subtitle="Tiếp nhận và giải quyết yêu cầu hỗ trợ từ người dùng." adminOnly={false}>
      <Notice kind="error">{list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      <div className={styles.toolbar}>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái">
          <option value="">Mọi trạng thái</option>
          {(Object.keys(statusLabel) as Status[]).map((value) => <option key={value} value={value}>{statusLabel[value]}</option>)}
        </select>
      </div>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Thời gian</th><th>Người gửi</th><th>Tiêu đề</th><th>Ưu tiên</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {list.data?.items.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td><td>{row.username}</td><td className={styles.wrap}>{row.subject}</td>
                  <td>{priorityLabel[row.priority]}</td><td><Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge></td>
                  <td><button type="button" className={styles.btn} onClick={() => setOpen(row)}>Xử lý</button></td>
                </tr>
              ))}
              {list.data?.items.length === 0 && <tr><td colSpan={6}>Không có yêu cầu hỗ trợ.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
      {open && <TicketModal ticket={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); setMessage('Đã cập nhật yêu cầu.'); list.reload() }} />}
    </AdminLayout>
  )
}
