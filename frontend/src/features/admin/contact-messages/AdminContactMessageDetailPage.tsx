import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../useAdmin'
import styles from '../admin.module.css'
import { formatDateTime } from '../../community/format'
import { ContactMessageStatusBadge } from './ContactMessageStatusBadge'
import { ContactConversation } from '../../contact/components/ContactConversation'
import type {
  ContactMessageRouteState,
  ContactMessageStatus,
} from './contact-messages.types'
import {
  getAdminContactMessage,
  getContactApiErrorMessage,
  replyToAdminContactMessage,
  toContactMessage,
  toContactReply,
  updateAdminContactMessageStatus,
  type ContactMessageDetailsResponse,
} from '../../contact/contact-api'
import pageStyles from './AdminContactMessagesPage.module.css'

const maximumReplyLength = 5000

const statusOptions: Array<{ value: ContactMessageStatus; label: string }> = [
  { value: 'NEW', label: 'Mới' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
]

function AdminContactMessageDetailPage() {
  const { messageId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as ContactMessageRouteState | null
  const { request, setNotice } = useAdmin()
  const [loaded, setLoaded] = useState<{
    messageId: string
    details: ContactMessageDetailsResponse | null
    error: string
  } | null>(null)
  const [status, setStatus] = useState<{ messageId: string; value: ContactMessageStatus } | null>(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [replyError, setReplyError] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const pendingIdempotencyRef = useRef<{ content: string; key: string } | null>(null)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)

  const currentLoad = loaded?.messageId === messageId ? loaded : null
  const details = currentLoad?.details ?? null
  const loading = currentLoad === null
  const loadError = currentLoad?.error ?? ''

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    void getAdminContactMessage(request, messageId, controller.signal)
      .then((response) => {
        setLoaded({ messageId, details: response, error: '' })
        setStatus({ messageId, value: response.status })
        setReplyContent('')
        setReplyError('')
        setStatusError('')
        pendingIdempotencyRef.current = null
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({
            messageId,
            details: null,
            error: getContactApiErrorMessage(error, 'Không thể tải chi tiết yêu cầu.'),
          })
        }
      })

    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [messageId, request])

  const message = details?.id === messageId ? toContactMessage(details) : null
  const messageReplies = details?.id === messageId
    ? details.replies.map(toContactReply)
    : []
  const selectedStatus = status?.messageId === messageId
    ? status.value
    : message?.status ?? 'NEW'

  function returnToList() {
    navigate('/admin/contact-messages', {
      state: { listState: routeState?.listState },
    })
  }

  async function saveStatus() {
    if (!message || isSavingStatus) return
    setIsSavingStatus(true)
    setStatusError('')
    try {
      const updated = await updateAdminContactMessageStatus(request, message.id, selectedStatus)
      if (!mountedRef.current) return
      setLoaded((current) => current?.messageId === updated.id && current.details
        ? {
          ...current,
          details: { ...current.details, status: updated.status, updatedAt: updated.updatedAt },
        }
        : current)
      setStatus({ messageId: updated.id, value: updated.status })
      setNotice('Đã cập nhật trạng thái yêu cầu.')
    } catch (error) {
      if (mountedRef.current) {
        setStatusError(getContactApiErrorMessage(error, 'Không thể cập nhật trạng thái.'))
      }
    } finally {
      if (mountedRef.current) setIsSavingStatus(false)
    }
  }

  function cancelReply() {
    if (!replyContent || window.confirm('Bạn có chắc muốn xóa nội dung phản hồi đang soạn?')) {
      setReplyContent('')
      setReplyError('')
      pendingIdempotencyRef.current = null
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message || inFlightRef.current) return
    const content = replyContent.trim()
    if (!content) {
      setReplyError('Vui lòng nhập nội dung phản hồi trước khi gửi.')
      return
    }

    const pending = pendingIdempotencyRef.current
    const idempotencyKey = pending?.content === content
      ? pending.key
      : crypto.randomUUID()
    pendingIdempotencyRef.current = { content, key: idempotencyKey }
    inFlightRef.current = true
    setIsSubmittingReply(true)
    setReplyError('')

    try {
      const result = await replyToAdminContactMessage(
        request,
        message.id,
        content,
        idempotencyKey,
      )
      if (!mountedRef.current) return
      const reply = toContactReply(result.reply)
      setLoaded((current) => current?.messageId === message.id && current.details
        ? {
          ...current,
          details: {
            ...current.details,
            replies: current.details.replies.some((item) => item.id === reply.id)
              ? current.details.replies
              : [...current.details.replies, {
                id: reply.id,
                contactMessageId: reply.contactMessageId,
                senderUserId: result.reply.senderUserId,
                senderRole: reply.senderType,
                senderName: reply.senderName,
                content: reply.content,
                createdAt: reply.createdAt,
              }],
          },
        }
        : current)
      setReplyContent('')
      setReplyError('')
      pendingIdempotencyRef.current = null
      setNotice(result.created
        ? 'Phản hồi đã được lưu thành công. Email chưa được gửi.'
        : 'Phản hồi đã được lưu trước đó. Email chưa được gửi.')
    } catch (error) {
      if (mountedRef.current) {
        setReplyError(getContactApiErrorMessage(error, 'Không thể gửi phản hồi. Hãy thử lại.'))
      }
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setIsSubmittingReply(false)
    }
  }

  if (loading || loadError || !message) {
    return (
      <>
        <div className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>HỖ TRỢ NGƯỜI DÙNG</p>
            <h1>{loadError ? 'Không thể tải yêu cầu' : loading ? 'Đang tải yêu cầu...' : 'Không tìm thấy yêu cầu'}</h1>
          </div>
          <button className={styles.buttonSecondary} type="button" onClick={returnToList}>
            <ArrowLeft size={16} aria-hidden="true" />
            Quay lại danh sách
          </button>
        </div>
        <section className={`${styles.panel} ${pageStyles.notFound}`} role={loadError ? 'alert' : 'status'}>
          <h2>{loadError ? 'Không thể tải yêu cầu' : loading ? 'Đang tải yêu cầu...' : 'Không tìm thấy yêu cầu'}</h2>
          <p>{loadError || (loading
            ? 'Vui lòng chờ trong giây lát.'
            : 'Yêu cầu này không tồn tại hoặc bạn không có quyền xem.')}</p>
        </section>
      </>
    )
  }

  return (
    <>
      <div className={`${styles.pageHeading} ${pageStyles.detailHeading}`}>
        <div>
          <p className={styles.eyebrow}>HỖ TRỢ NGƯỜI DÙNG</p>
          <h1>Chi tiết yêu cầu</h1>
          <p className={styles.pageSubtitle}>Xem nội dung, cập nhật trạng thái và soạn phản hồi.</p>
        </div>
        <button className={styles.buttonSecondary} type="button" onClick={returnToList}>
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại danh sách
        </button>
      </div>

      <div className={pageStyles.detailGrid}>
        <section className={`${styles.panel} ${pageStyles.messagePanel}`} aria-labelledby="request-information-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="request-information-title">Thông tin yêu cầu</h2>
              <p>Mã yêu cầu: <strong>{message.id}</strong></p>
            </div>
            <ContactMessageStatusBadge status={message.status} />
          </div>

          <h3 className={pageStyles.subjectHeading}>{message.subject}</h3>
          <dl className={pageStyles.senderDetails}>
            <div><dt>Người gửi</dt><dd>{message.fullName}</dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${message.email}`}>{message.email}</a></dd></div>
            <div><dt>Ngày giờ gửi</dt><dd>{formatDateTime(message.createdAt)}</dd></div>
          </dl>
          <div className={pageStyles.requestContent}>
            <h3>Nội dung yêu cầu</h3>
            <p>{message.message}</p>
          </div>
        </section>

        <section className={`${styles.panel} ${pageStyles.statusPanel}`} aria-labelledby="status-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="status-title">Trạng thái yêu cầu</h2>
              <p>Trạng thái do Admin quản lý riêng.</p>
            </div>
          </div>
          <label className={pageStyles.formLabel} htmlFor="detail-contact-status">Trạng thái</label>
          <select
            id="detail-contact-status"
            className={pageStyles.formSelect}
            value={selectedStatus}
            disabled={isSavingStatus}
            onChange={(event) => setStatus({
              messageId: message.id,
              value: event.target.value as ContactMessageStatus,
            })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {statusError && <p className={styles.formMessage} role="alert">{statusError}</p>}
          <button className={styles.buttonPrimary} type="button" onClick={() => void saveStatus()} disabled={isSavingStatus}>
            {isSavingStatus ? 'Đang lưu...' : 'Lưu trạng thái'}
          </button>
        </section>
      </div>

      <section className={`${styles.panel} ${pageStyles.replyPanel}`} aria-labelledby="reply-title">
        <div className={styles.panelHeading}>
          <div>
            <h2 id="reply-title">Phản hồi người dùng</h2>
            <p>Soạn nội dung trả lời cho yêu cầu này.</p>
          </div>
        </div>
        <form onSubmit={(event) => void submitReply(event)}>
          <p className={pageStyles.recipient}><strong>Người nhận:</strong> {message.email}</p>
          <label className={pageStyles.formLabel} htmlFor="contact-reply-content">Nội dung phản hồi</label>
          <textarea
            id="contact-reply-content"
            className={pageStyles.replyTextarea}
            placeholder="Nhập nội dung phản hồi cho người dùng..."
            maxLength={maximumReplyLength}
            value={replyContent}
            disabled={isSubmittingReply}
            aria-describedby="contact-reply-counter contact-reply-note"
            onChange={(event) => {
              setReplyContent(event.target.value)
              if (replyError) setReplyError('')
            }}
          />
          <div className={pageStyles.replyMeta}>
            <p id="contact-reply-note">
              {message.ownerUserId
                ? 'Phản hồi được lưu trên hệ thống. Email chưa được gửi.'
                : 'Yêu cầu Guest chưa hỗ trợ theo dõi phản hồi trực tuyến; phản hồi chỉ được lưu cho Admin.'}
            </p>
            <span id="contact-reply-counter" aria-live="polite">
              {replyContent.length.toLocaleString('vi-VN')} / {maximumReplyLength.toLocaleString('vi-VN')} ký tự
            </span>
          </div>
          {replyError && <p className={styles.formMessage} role="alert">{replyError}</p>}
          <div className={pageStyles.replyActions}>
            <button className={styles.buttonSecondary} type="button" onClick={cancelReply} disabled={isSubmittingReply}>
              Hủy nội dung
            </button>
            <button
              className={styles.buttonPrimary}
              type="submit"
              disabled={!replyContent.trim() || isSubmittingReply}
            >
              <Send size={15} aria-hidden="true" />
              {isSubmittingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
            </button>
          </div>
        </form>
      </section>

      <section className={`${styles.panel} ${pageStyles.historyPanel}`} aria-labelledby="conversation-title">
        <div className={styles.panelHeading}>
          <div>
            <h2 id="conversation-title">Lịch sử trao đổi</h2>
            <p>Các tin nhắn liên quan đến yêu cầu {message.id}.</p>
          </div>
          <span className={pageStyles.replyCount}>{messageReplies.length}</span>
        </div>
        <ContactConversation
          replies={messageReplies}
          viewer="admin"
          emptyMessage="Chưa có phản hồi nào cho yêu cầu này."
        />
      </section>
    </>
  )
}

export default AdminContactMessageDetailPage
