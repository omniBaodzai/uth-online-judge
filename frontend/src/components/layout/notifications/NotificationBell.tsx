import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Bell, Inbox, MessageCircleReply } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '../../../features/auth/useAuth'
import {
  getContactApiErrorMessage,
  getMyUnreadNotificationCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from '../../../features/contact/contact-api'
import { useToast } from '../../ui/toast-context'
import type { UserNotification } from './notifications.types'
import styles from './NotificationBell.module.css'
import { buildDiscussionCommentHref } from '../../../features/community/discussion-comment-navigation'
import { buildProblemCommentHref } from '../../../features/community/problem-comment-navigation'

const notificationRefreshInterval = 60_000

type NotificationBellProps = {
  userId: string
}

function formatRelativeTime(value: string, t: TFunction<'common'>, language: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return t('unknownTime')

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (elapsedMinutes < 1) return t('justNow')
  if (elapsedMinutes < 60) return t('minutesAgo', { count: elapsedMinutes })
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return t('hoursAgo', { count: elapsedHours })
  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return t('daysAgo', { count: elapsedDays })
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(timestamp)
}

function NotificationBell({ userId }: NotificationBellProps) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('common')
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi'
  const { user, request } = useAuth()
  const { showToast } = useToast()
  const isCurrentUser = user?.id === userId
  const requestRef = useRef(request)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [countError, setCountError] = useState('')
  const [mobileDropdownPosition, setMobileDropdownPosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(false)
  const isOpenRef = useRef(false)
  const isLoadingListRef = useRef(false)
  const isLoadingCountRef = useRef(false)
  const isMarkingAllRef = useRef(false)
  const listSequenceRef = useRef(0)
  const countSequenceRef = useRef(0)
  const dropdownId = useId()

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isCurrentUser || isLoadingCountRef.current) return
    isLoadingCountRef.current = true
    const sequence = ++countSequenceRef.current
    try {
      const response = await getMyUnreadNotificationCount(requestRef.current)
      if (mountedRef.current && sequence === countSequenceRef.current) {
        setUnreadCount(Number.isFinite(response.count) ? Math.max(0, response.count) : 0)
        setCountError('')
      }
    } catch (error) {
      if (mountedRef.current && sequence === countSequenceRef.current) {
        setCountError(getContactApiErrorMessage(error, t('notificationCountError')))
      }
    } finally {
      isLoadingCountRef.current = false
    }
  }, [isCurrentUser, t])

  const refreshNotifications = useCallback(async () => {
    if (!isCurrentUser || isLoadingListRef.current) return
    isLoadingListRef.current = true
    setIsLoadingNotifications(true)
    setNotificationError('')
    const sequence = ++listSequenceRef.current
    try {
      const response = await listMyNotifications(requestRef.current)
      if (mountedRef.current && sequence === listSequenceRef.current) {
        setNotifications(response.items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.content,
          contactMessageId: item.contactMessageId,
          actorUserId: item.actorUserId,
          actorName: item.actorName,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          targetType: item.targetType,
          targetId: item.targetId,
          targetAvailable: item.targetAvailable,
          metadata: item.metadata,
          isRead: item.isRead,
          createdAt: item.createdAt,
        })))
        setNotificationsLoaded(true)
      }
    } catch (error) {
      if (mountedRef.current && sequence === listSequenceRef.current) {
        setNotifications([])
        setNotificationsLoaded(true)
        setNotificationError(getContactApiErrorMessage(error, t('notificationLoadError')))
      }
    } finally {
      isLoadingListRef.current = false
      if (mountedRef.current && sequence === listSequenceRef.current) setIsLoadingNotifications(false)
    }
  }, [isCurrentUser, t])

  useEffect(() => {
    if (!isCurrentUser) return
    let active = true

    const refreshWhenActive = () => {
      if (!active || document.visibilityState !== 'visible') return
      void refreshUnreadCount()
      if (isOpenRef.current) void refreshNotifications()
    }

    void refreshUnreadCount()
    window.addEventListener('focus', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)
    const intervalId = window.setInterval(refreshWhenActive, notificationRefreshInterval)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [isCurrentUser, refreshNotifications, refreshUnreadCount])

  useEffect(() => {
    if (!isOpen) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        isOpenRef.current = false
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        isOpenRef.current = false
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [isOpen])

  function toggleDropdown() {
    if (!isOpen && window.matchMedia('(max-width: 1200px)').matches) {
      const bounds = buttonRef.current?.getBoundingClientRect()
      const rootBounds = rootRef.current?.getBoundingClientRect()
      if (bounds && rootBounds) {
        const viewportWidth = document.documentElement.clientWidth
        const width = Math.min(380, Math.max(0, viewportWidth - 32))
        const viewportLeft = Math.max(16, Math.min(bounds.left, viewportWidth - width - 16))
        setMobileDropdownPosition({
          left: viewportLeft - rootBounds.left,
          top: bounds.bottom + 8 - rootBounds.top,
          width,
        })
      }
    }
    const nextIsOpen = !isOpen
    isOpenRef.current = nextIsOpen
    setIsOpen(nextIsOpen)
    if (nextIsOpen) {
      void refreshNotifications()
      void refreshUnreadCount()
    }
  }

  async function openNotification(notification: UserNotification) {
    isOpenRef.current = false
    setIsOpen(false)

    let destination: string
    let unavailable = false

    if (notification.type === 'CONTACT_REPLY') {
      if (!notification.contactMessageId.trim()) {
        showToast(t('invalidNotificationLink'))
        return
      }
      destination = `/my/contact-messages/${encodeURIComponent(notification.contactMessageId)}`
    } else if (notification.type === 'DISCUSSION_COMMENT' || notification.type === 'DISCUSSION_REPLY') {
      const metadata = notification.metadata
      const discussionId = metadata?.discussionId
      const metadataCommentId = metadata?.commentId
      const commentId = notification.targetId ?? metadataCommentId
      const rootCommentId = metadata?.rootCommentId ?? commentId
      if (
        notification.targetType !== 'DISCUSSION_COMMENT'
        || !discussionId
        || !commentId
        || !rootCommentId
        || (notification.targetId && metadataCommentId && notification.targetId !== metadataCommentId)
      ) {
        showToast(t('invalidNotificationLink'))
        return
      }
      destination = buildDiscussionCommentHref({ discussionId, commentId, rootCommentId })
      unavailable = notification.targetAvailable !== true || !notification.targetId
    } else if (notification.type === 'PROBLEM_REPLY') {
      const metadata = notification.metadata
      const problemCode = metadata?.problemCode
      const metadataCommentId = metadata?.commentId
      const commentId = notification.targetId ?? metadataCommentId
      const rootCommentId = metadata?.rootCommentId
      if (
        notification.targetType !== 'PROBLEM_COMMENT'
        || !problemCode
        || !commentId
        || !rootCommentId
        || (notification.targetId && metadataCommentId && notification.targetId !== metadataCommentId)
      ) {
        showToast(t('invalidNotificationLink'))
        return
      }
      destination = buildProblemCommentHref({ problemCode, commentId, rootCommentId })
      unavailable = notification.targetAvailable !== true || !notification.targetId
    } else {
      showToast(t('invalidNotificationLink'))
      return
    }

    let readSucceeded = true
    if (!notification.isRead && isCurrentUser) {
      try {
        const result = await markMyNotificationRead(requestRef.current, notification.id)
        if (!mountedRef.current) return
        if (result.isRead) {
          setNotifications((current) => current.map((item) => (
            item.id === notification.id ? { ...item, isRead: true } : item
          )))
          setUnreadCount((current) => Math.max(0, current - 1))
          void refreshUnreadCount()
        } else {
          readSucceeded = false
        }
      } catch (error) {
        readSucceeded = false
        if (mountedRef.current) {
          showToast(getContactApiErrorMessage(error, t('markReadError')))
        }
      }
    }

    if (!mountedRef.current) return
    if (unavailable) {
      if (readSucceeded) {
        const messageKey = notification.type === 'PROBLEM_REPLY'
          ? 'problemNotificationUnavailable'
          : 'discussionNotificationUnavailable'
        showToast(t(messageKey))
      }
      return
    }

    navigate(destination)
  }

  async function markAllRead() {
    if (!isCurrentUser || isMarkingAllRef.current) return
    isMarkingAllRef.current = true
    setIsMarkingAllRead(true)
    try {
      await markAllMyNotificationsRead(requestRef.current)
      if (!mountedRef.current) return
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })))
      setUnreadCount(0)
      setCountError('')
      setNotificationError('')
    } catch (error) {
      if (mountedRef.current) {
        showToast(getContactApiErrorMessage(error, t('markAllReadError')))
      }
    } finally {
      isMarkingAllRef.current = false
      if (mountedRef.current) setIsMarkingAllRead(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        className={styles.trigger}
        type="button"
        aria-label={unreadCount ? t('unreadNotifications', { count: unreadCount }) : t('notifications')}
        aria-expanded={isOpen}
        aria-controls={isOpen ? dropdownId : undefined}
        onClick={toggleDropdown}
      >
        <Bell size={21} strokeWidth={1.9} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className={styles.dropdown}
          id={dropdownId}
          aria-label={t('notificationList')}
          style={mobileDropdownPosition ? {
            position: 'absolute',
            left: mobileDropdownPosition.left,
            right: 'auto',
            top: mobileDropdownPosition.top,
            width: mobileDropdownPosition.width,
            maxHeight: `min(540px, calc(100dvh - ${mobileDropdownPosition.top}px - 16px))`,
          } : undefined}
        >
          <header className={styles.dropdownHeader}>
            <div className={styles.heading}>
              <h2>{t('notifications')}</h2>
              {unreadCount > 0 && <span className={styles.unreadCount}>{t('unreadCount', { count: unreadCount })}</span>}
            </div>
            {unreadCount > 0 && (
              <button
                className={styles.markAllButton}
                type="button"
                onClick={() => void markAllRead()}
                disabled={isMarkingAllRead}
              >
                {isMarkingAllRead ? t('updating') : t('markAllRead')}
              </button>
            )}
          </header>

          {countError && <p className={styles.disclaimer} role="alert">{countError}</p>}
          {isLoadingNotifications || !notificationsLoaded ? (
            <div className={styles.emptyState} role="status">
              <span className={styles.emptyIcon}><Inbox size={22} aria-hidden="true" /></span>
              <p>{t('loadingNotifications')}</p>
            </div>
          ) : notificationError ? (
            <p className={styles.disclaimer} role="alert">{notificationError}</p>
          ) : notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><Inbox size={22} aria-hidden="true" /></span>
              <p>{t('noNotifications')}</p>
            </div>
          ) : (
            <ul className={styles.notificationList} aria-label={t('notificationCount', { count: notifications.length })}>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                    type="button"
                    aria-label={`${notification.title}. ${notification.message} ${formatRelativeTime(notification.createdAt, t, language)}${notification.isRead ? `, ${t('read')}` : `, ${t('unread')}`}`}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className={styles.notificationIcon}>
                      <MessageCircleReply size={18} aria-hidden="true" />
                    </span>
                    <span className={styles.notificationContent}>
                      <span className={styles.notificationTitle}>{notification.title}</span>
                      <span className={styles.notificationMessage}>{notification.message}</span>
                      <span className={styles.notificationMeta}>
                        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt, t, language)}</time>
                        <span className={styles.mockLabel}>{notification.isRead ? t('read') : t('unread')}</span>
                      </span>
                    </span>
                    {!notification.isRead && <span className={styles.unreadDot} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.disclaimer}>{t('notificationDisclaimer')}</p>
        </section>
      )}
    </div>
  )
}

export default NotificationBell
