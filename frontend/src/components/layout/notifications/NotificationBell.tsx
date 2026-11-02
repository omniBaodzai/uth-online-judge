import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Bell, Inbox, MessageCircleReply } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

const notificationRefreshInterval = 60_000

type NotificationBellProps = {
  userId: string
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return 'Thời gian không xác định'

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (elapsedMinutes < 1) return 'Vừa xong'
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} giờ trước`
  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return `${elapsedDays} ngày trước`
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(timestamp)
}

function NotificationBell({ userId }: NotificationBellProps) {
  const navigate = useNavigate()
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
        setCountError(getContactApiErrorMessage(error, 'Không thể cập nhật số thông báo chưa đọc.'))
      }
    } finally {
      isLoadingCountRef.current = false
    }
  }, [isCurrentUser])

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
          isRead: item.isRead,
          createdAt: item.createdAt,
        })))
        setNotificationsLoaded(true)
      }
    } catch (error) {
      if (mountedRef.current && sequence === listSequenceRef.current) {
        setNotifications([])
        setNotificationsLoaded(true)
        setNotificationError(getContactApiErrorMessage(error, 'Không thể tải thông báo. Vui lòng thử lại.'))
      }
    } finally {
      isLoadingListRef.current = false
      if (mountedRef.current && sequence === listSequenceRef.current) setIsLoadingNotifications(false)
    }
  }, [isCurrentUser])

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
    if (!isOpen && window.matchMedia('(max-width: 1160px)').matches) {
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

    if (notification.type !== 'CONTACT_REPLY' || !notification.contactMessageId.trim()) {
      showToast('Thông báo không có liên kết yêu cầu hợp lệ.')
      return
    }

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
        }
      } catch (error) {
        if (mountedRef.current) {
          showToast(getContactApiErrorMessage(error, 'Không thể đánh dấu thông báo đã đọc.'))
        }
      }
    }

    if (!mountedRef.current) return
    navigate(`/my/contact-messages/${encodeURIComponent(notification.contactMessageId)}`)
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
        showToast(getContactApiErrorMessage(error, 'Không thể đánh dấu tất cả thông báo đã đọc.'))
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
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
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
          aria-label="Danh sách thông báo"
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
              <h2>Thông báo</h2>
              {unreadCount > 0 && <span className={styles.unreadCount}>{unreadCount} chưa đọc</span>}
            </div>
            {unreadCount > 0 && (
              <button
                className={styles.markAllButton}
                type="button"
                onClick={() => void markAllRead()}
                disabled={isMarkingAllRead}
              >
                {isMarkingAllRead ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
              </button>
            )}
          </header>

          {countError && <p className={styles.disclaimer} role="alert">{countError}</p>}
          {isLoadingNotifications || !notificationsLoaded ? (
            <div className={styles.emptyState} role="status">
              <span className={styles.emptyIcon}><Inbox size={22} aria-hidden="true" /></span>
              <p>Đang tải thông báo...</p>
            </div>
          ) : notificationError ? (
            <p className={styles.disclaimer} role="alert">{notificationError}</p>
          ) : notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><Inbox size={22} aria-hidden="true" /></span>
              <p>Bạn chưa có thông báo nào.</p>
            </div>
          ) : (
            <ul className={styles.notificationList} aria-label={`${notifications.length} thông báo`}>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                    type="button"
                    aria-label={`${notification.title}. ${notification.message} ${formatRelativeTime(notification.createdAt)}${notification.isRead ? ', đã đọc' : ', chưa đọc'}`}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className={styles.notificationIcon}>
                      <MessageCircleReply size={18} aria-hidden="true" />
                    </span>
                    <span className={styles.notificationContent}>
                      <span className={styles.notificationTitle}>{notification.title}</span>
                      <span className={styles.notificationMessage}>{notification.message}</span>
                      <span className={styles.notificationMeta}>
                        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                        <span className={styles.mockLabel}>{notification.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
                      </span>
                    </span>
                    {!notification.isRead && <span className={styles.unreadDot} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.disclaimer}>Thông báo phản hồi được cập nhật từ hệ thống.</p>
        </section>
      )}
    </div>
  )
}

export default NotificationBell
