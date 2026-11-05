import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MessageCircleReply, Send } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatDateTime } from '../../community/format'
import { reportTypes } from '../../problems/detail-data'
import '../../problems/i18n'
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

function UserContactMessageDetailsPage() {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
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
            error: getContactApiErrorMessage(error, t('contactRequestLoadError')),
          })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [messageId, t, user?.id])

  const currentLoad = loaded?.key === pageKey ? loaded : null
  const details = currentLoad?.details ?? null
  const loading = currentLoad === null
  const loadError = currentLoad?.error ?? ''
  const message = details?.id === messageId ? toContactMessage(details) : null
  const messageReplies = details?.id === messageId
    ? details.replies.map(toContactReply)
    : []
  const statusLabel = t({
    NEW: 'contactStatusNew',
    IN_PROGRESS: 'contactStatusInProgress',
    RESOLVED: 'contactStatusResolved',
  }[message?.status ?? 'NEW'])
  const replyContent = draft.key === pageKey ? draft.content : ''
  const currentFeedback = feedback.key === pageKey ? feedback : { key: pageKey, error: '', notice: '' }
  const isSubmitting = submitting.key === pageKey && submitting.value

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message || message.status === 'RESOLVED' || inFlightRef.current) return

    const content = replyContent.trim()
    if (!content) {
      setFeedback({ key: pageKey, error: t('contactReplyRequired'), notice: '' })
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
          ? t('contactReplySent')
          : t('contactReplyAlreadySent'),
      })
      pendingIdempotencyRef.current = null
    } catch (error) {
      if (activePageKeyRef.current === pageKey) {
        setFeedback({
          key: pageKey,
          error: getContactApiErrorMessage(error, t('contactReplySendError')),
          notice: '',
        })
      }
    } finally {
      inFlightRef.current = false
      if (activePageKeyRef.current === pageKey) setSubmitting({ key: pageKey, value: false })
    }
  }

  if (loading || loadError || !message) {
    const title = loading ? t('contactRequestLoading') : t('contactRequestNotFound')
    const description = loading
      ? t('pleaseWait')
      : loadError || t('contactRequestUnavailable')

    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.notFound} aria-labelledby="contact-not-found-title" role={loading ? 'status' : 'alert'}>
            <p className={styles.eyebrow}>{t('contactUserSupport')}</p>
            <h1 id="contact-not-found-title">{title}</h1>
            <p>{description}</p>
            <button className={styles.secondaryButton} type="button" onClick={() => navigate('/contact')}>
              <ArrowLeft size={17} aria-hidden="true" />
              {t('backToContact')}
            </button>
          </section>
        </div>
      </main>
    )
  }

  const isResolved = message.status === 'RESOLVED'
  const reportTypeLabelKey = reportTypes.find((item) => item.value === message.reportType)?.labelKey

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.card} aria-labelledby="original-request-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><MessageCircleReply size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="original-request-title">{t('contactOriginalRequest')}</h2>
              <p>{t('contactOriginalRequestDescription')}</p>
            </div>
          </div>
          <h3 className={styles.subject}>{message.subject}</h3>
          <dl className={styles.senderDetails}>
            <div><dt>{t('contactSender')}</dt><dd>{message.fullName}</dd></div>
            <div><dt>{t('contactEmail')}</dt><dd>{message.email}</dd></div>
            <div><dt>{t('contactSentAt')}</dt><dd>{formatDateTime(message.createdAt, locale)}</dd></div>
            {message.category === 'PROBLEM_REPORT' && (
              <>
                <div><dt>{t('contactRequestType')}</dt><dd>{t('contactCategoryProblemReport')}</dd></div>
                <div>
                  <dt>{t('contactReportedProblem')}</dt>
                  <dd>
                    {message.problemId && message.problemCode ? (
                      <Link to={`/problems/${encodeURIComponent(message.problemCode)}`}>
                        {message.problemCode} – {message.problemTitle}
                      </Link>
                    ) : `${message.problemCode ?? ''} – ${message.problemTitle ?? ''} (${t('contactProblemDeleted')})`}
                  </dd>
                </div>
                {reportTypeLabelKey && <div><dt>{t('contactReportType')}</dt><dd>{t(reportTypeLabelKey)}</dd></div>}
              </>
            )}
          </dl>
          <div className={styles.originalContent}>
            <h3>{t('contactRequestContent')}</h3>
            <p>{message.message}</p>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="conversation-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><MessageCircleReply size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="conversation-title">{t('contactConversationHistory')}</h2>
              <p>{t('contactRepliesChronological')}</p>
            </div>
          </div>
          <ContactConversation
            replies={messageReplies}
            viewer="user"
            emptyMessage={t('contactConversationEmpty')}
          />
        </section>

        <section className={styles.card} aria-labelledby="send-reply-title">
          <div className={styles.sectionHeading}>
            <span className={styles.headingIcon}><Send size={18} aria-hidden="true" /></span>
            <div>
              <h2 id="send-reply-title">{t('contactSendReply')}</h2>
              <p>
                {t('contactCurrentStatus')}: <strong>{statusLabel}</strong>.
                {isResolved
                  ? ` ${t('contactResolvedCannotReply')}`
                  : ` ${t('contactReplyDoesNotChangeStatus')}`}
              </p>
            </div>
          </div>
          <form className={styles.replyForm} onSubmit={(event) => void submitReply(event)}>
            <label htmlFor="user-contact-reply">{t('contactReplyContent')}</label>
            <textarea
              id="user-contact-reply"
              maxLength={maximumReplyLength}
              placeholder={t('contactReplyPlaceholder')}
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
                  ? t('contactResolvedReplyNote')
                  : t('contactReplyDeliveryNote')}
              </span>
              <span id="user-contact-reply-counter" aria-live="polite">
                {t('characterCount', {
                  count: new Intl.NumberFormat(locale).format(replyContent.length),
                  max: new Intl.NumberFormat(locale).format(maximumReplyLength),
                })}
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
                {isSubmitting ? t('sending') : t('contactSendReply')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

export default UserContactMessageDetailsPage
