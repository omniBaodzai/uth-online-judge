import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, MessageCircleReply, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type { ContactMessageStatus } from '../../admin/contact-messages/contact-messages.types'
import { formatDateTime } from '../../community/format'
import { ContactConversation } from '../components/ContactConversation'
import {
  getContactApiErrorMessage,
  getMyContactMessage,
  replyToMyContactMessage,
  toContactMessage,
  toContactReply,
  type ContactMessageDetailsResponse,
} from '../contact-api'
import styles from './UserContactMessageDetailsPage.module.css'

const maximumReplyLength = 5000

const statusLabels: Record<ContactMessageStatus, string> = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
}

function UserContactMessageDetailsPage() {
  const { messageId = '' } = useParams()
  const navigate = useNavigate()
  const { user, request } = useAuth()
  const requestRef = useRef(request)
  const pageKey = `${user?.id ?? ''}:${messageId}`
  const activePageKeyRef = useRef(pageKey)
  const [loaded, setLoaded] = useState<{
    key: string
    details: ContactMessageDetailsResponse | null
    error: string
  } | null>(null)
  const [draft, setDraft] = useState<{ key: string; content: string }>({ key: '', content: '' })
  const [feedback, setFeedback] = useState<{ key: string; error: string; notice: string }>({
    key: '',
    error: '',
    notice: '',
  })
  const [submitting, setSubmitting] = useState<{ key: string; value: boolean }>({
    key: '',
    value: false,
  })
  const inFlightRef = useRef(false)
  const pendingIdempotencyRef = useRef<{ key: string; content: string; idempotencyKey: string } | null>(null)

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    activePageKeyRef.current = pageKey
    pendingIdempotencyRef.current = null
  }, [pageKey])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const key = `${user?.id ?? ''}:${messageId}`

    void getMyContactMessage(requestRef.current, messageId, controller.signal)
      .then((response) => {
        if (active) setLoaded({ key, details: response, error: '' })
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setLoaded({
            key,
            details: null,
            error: getContactApiErrorMessage(error, 'Không thể tải yêu cầu liên hệ.'),
          })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [messageId, user?.id])

  const currentLoad = loaded?.key === pageKey ? loaded : null
  const details = currentLoad?.details ?? null
  const loading = currentLoad === null
  const loadError = currentLoad?.error ?? ''
  const message = details?.id === messageId ? toContactMessage(details) : null
  const messageReplies = details?.id === messageId
    ? details.replies.map(toContactReply)
    : []
  const replyContent = draft.key === pageKey ? draft.content : ''
  const currentFeedback = feedback.key === pageKey ? feedback : { key: pageKey, error: '', notice: '' }
  const isSubmitting = submitting.key === pageKey && submitting.value

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message || message.status === 'RESOLVED' || inFlightRef.current) return

    const content = replyContent.trim()
    if (!content) {
      setFeedback({ key: pageKey, error: 'Vui lòng nhập nội dung phản hồi trước khi gửi.', notice: '' })
      return
    }

    const pending = pendingIdempotencyRef.current
    const idempotencyKey = pending?.key === pageKey && pending.content === content
      ? pending.idempotencyKey
      : crypto.randomUUID()
    pendingIdempotencyRef.current = { key: pageKey, content, idempotencyKey }
    inFlightRef.current = true
    setSubmitting({ key: pageKey, value: true })
    setFeedback({ key: pageKey, error: '', notice: '' })

    try {
      const result = await replyToMyContactMessage(
        requestRef.current,
        message.id,
        content,
        idempotencyKey,
      )
      if (activePageKeyRef.current !== pageKey) return

      const reply = toContactReply(result.reply)
      setLoaded((current) => current?.key === pageKey && current.details
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
      setDraft({ key: pageKey, content: '' })
      setFeedback({
        key: pageKey,
        error: '',
        notice: result.created
          ? 'Phản hồi đã được gửi thành công.'
          : 'Phản hồi này đã được gửi trước đó.',
      })
      pendingIdempotencyRef.current = null
    } catch (error) {
      if (activePageKeyRef.current === pageKey) {
        setFeedback({
          key: pageKey,
          error: getContactApiErrorMessage(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'),
          notice: '',
        })
      }
    } finally {
      inFlightRef.current = false
      if (activePageKeyRef.current === pageKey) setSubmitting({ key: pageKey, value: false })
    }
  }

  if (loading || loadError || !message) {
    const title = loading ? 'Đang tải yêu cầu...' : 'Không tìm thấy yêu cầu'
    const description = loading
      ? 'Vui lòng chờ trong giây lát.'
      : loadError || 'Yêu cầu không tồn tại hoặc bạn không có quyền xem nội dung này.'

    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.notFound} aria-labelledby="contact-not-found-title" role={loading ? 'status' : 'alert'}>
            <p className={styles.eyebrow}>HỖ TRỢ NGƯỜI DÙNG</p>
            <h1 id="contact-not-found-title">{title}</h1>
            <p>{description}</p>
            <button className={styles.secondaryButton} type="button" onClick={() => navigate('/contact')}>
              <ArrowLeft size={17} aria-hidden="true" />
              Quay lại trang liên hệ
            </button>
          </section>
        </div>
      </main>
    )
  }

  const isResolved = message.status === 'RESOLVED'

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.card} aria-labelledby="original-request-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><MessageCircleReply size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="original-request-title">Yêu cầu ban đầu</h2>
              <p>Nội dung đã gửi đến đội ngũ hỗ trợ.</p>
            </div>
          </div>
          <h3 className={styles.subject}>{message.subject}</h3>
          <dl className={styles.senderDetails}>
            <div><dt>Người gửi</dt><dd>{message.fullName}</dd></div>
            <div><dt>Email</dt><dd>{message.email}</dd></div>
            <div><dt>Thời gian gửi</dt><dd>{formatDateTime(message.createdAt)}</dd></div>
          </dl>
          <div className={styles.originalContent}>
            <h3>Nội dung yêu cầu</h3>
            <p>{message.message}</p>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="conversation-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><MessageCircleReply size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="conversation-title">Lịch sử trao đổi</h2>
              <p>Phản hồi được sắp xếp theo thời gian gửi.</p>
            </div>
          </div>
          <ContactConversation
            replies={messageReplies}
            viewer="user"
            emptyMessage="Yêu cầu của bạn đã được tiếp nhận. Đội ngũ hỗ trợ sẽ phản hồi sớm nhất có thể."
          />
        </section>

        <section className={styles.card} aria-labelledby="send-reply-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><Send size={18} aria-hidden="true" /></span>
            <div>
              <h2 id="send-reply-title">Gửi phản hồi</h2>
              <p>
                Trạng thái hiện tại: <strong>{statusLabels[message.status]}</strong>.
                {isResolved
                  ? ' Yêu cầu đã được xử lý; bạn không thể gửi thêm phản hồi.'
                  : ' Gửi phản hồi không tự thay đổi trạng thái.'}
              </p>
            </div>
          </div>
          <form className={styles.replyForm} onSubmit={(event) => void submitReply(event)}>
            <label htmlFor="user-contact-reply">Nội dung phản hồi</label>
            <textarea
              id="user-contact-reply"
              maxLength={maximumReplyLength}
              placeholder="Nhập nội dung phản hồi của bạn..."
              value={replyContent}
              disabled={isResolved || isSubmitting}
              aria-describedby="user-contact-reply-counter user-contact-reply-note user-contact-reply-error"
              onChange={(event) => {
                setDraft({ key: pageKey, content: event.target.value })
                setFeedback({ key: pageKey, error: '', notice: '' })
              }}
            />
            <div className={styles.replyMeta}>
              <span id="user-contact-reply-note">
                {isResolved
                  ? 'Yêu cầu đã được xử lý. Liên hệ Admin nếu cần mở lại.'
                  : 'Phản hồi được lưu trên hệ thống; email chưa được gửi.'}
              </span>
              <span id="user-contact-reply-counter" aria-live="polite">
                {replyContent.length.toLocaleString('vi-VN')} / {maximumReplyLength.toLocaleString('vi-VN')} ký tự
              </span>
            </div>
            {currentFeedback.error && (
              <p className={styles.errorMessage} id="user-contact-reply-error" role="alert">
                {currentFeedback.error}
              </p>
            )}
            {!currentFeedback.error && <span className={styles.visuallyHidden} id="user-contact-reply-error" />}
            {currentFeedback.notice && <p className={styles.successMessage} role="status">{currentFeedback.notice}</p>}
            <div className={styles.replyActions}>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={!replyContent.trim() || isResolved || isSubmitting}
              >
                <Send size={16} aria-hidden="true" />
                {isSubmitting ? 'Đang gửi...' : 'Gửi phản hồi'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

export default UserContactMessageDetailsPage
