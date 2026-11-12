// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from './NotificationBell'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  showToast: vi.fn(),
  translate: (key: string) => key,
  user: { id: 'user-1' },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.translate, i18n: { resolvedLanguage: 'en' } }),
}))

vi.mock('../../../features/auth/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, request: mocks.request }),
}))

vi.mock('../../ui/toast-context', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

type TestNotification = {
  id: string
  type: 'CONTACT_REPLY' | 'DISCUSSION_COMMENT' | 'DISCUSSION_REPLY' | 'PROBLEM_REPLY'
  title: string
  content: string
  contactMessageId: string
  targetType?: 'CONTACT_MESSAGE' | 'DISCUSSION_COMMENT' | 'PROBLEM_COMMENT'
  targetId?: string | null
  targetAvailable?: boolean
  metadata?: Record<string, string>
  isRead: boolean
  createdAt: string
  readAt: string | null
}

function discussionNotification(overrides: Partial<TestNotification> = {}): TestNotification {
  return {
    id: 'notification-1',
    type: 'DISCUSSION_REPLY',
    title: 'A new reply',
    content: 'Someone replied to your comment',
    contactMessageId: '',
    targetType: 'DISCUSSION_COMMENT',
    targetId: 'reply-1',
    targetAvailable: true,
    metadata: {
      discussionId: 'discussion-1',
      commentId: 'reply-1',
      rootCommentId: 'root-1',
    },
    isRead: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  }
}

function LocationOutput() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

let root: Root
let container: HTMLDivElement
let currentNotification: TestNotification
let readFailure: Error | null

beforeEach(() => {
  vi.clearAllMocks()
  currentNotification = discussionNotification()
  readFailure = null
  mocks.request.mockImplementation(async (path: string) => {
    if (path === '/my/notifications/unread-count') return { count: currentNotification.isRead ? 0 : 1 }
    if (path === '/my/notifications?page=1&pageSize=50') {
      return {
        items: [currentNotification],
        total: 1,
        unreadCount: currentNotification.isRead ? 0 : 1,
        page: 1,
        pageSize: 50,
      }
    }
    if (path === `/my/notifications/${currentNotification.id}/read`) {
      if (readFailure) throw readFailure
      currentNotification = { ...currentNotification, isRead: true }
      return { id: currentNotification.id, isRead: true }
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderBell(initialEntry = '/') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="*"
            element={(
              <>
                <NotificationBell userId="user-1" />
                <LocationOutput />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function openNotificationList() {
  const trigger = container.querySelector('button')
  expect(trigger).not.toBeNull()
  await act(async () => {
    trigger?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function clickNotification() {
  const item = container.querySelector<HTMLButtonElement>('ul button')
  expect(item).not.toBeNull()
  await act(async () => {
    item?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('NotificationBell navigation', () => {
  it('opens the nested comment deep link and marks the notification read', async () => {
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/discussions/discussion-1?commentId=reply-1&rootCommentId=root-1')
    expect(mocks.request).toHaveBeenCalledWith(
      '/my/notifications/notification-1/read',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('opens a problem reply deep link and marks the notification read', async () => {
    currentNotification = discussionNotification({
      type: 'PROBLEM_REPLY',
      title: 'A new reply',
      content: 'Someone replied to your problem comment',
      targetType: 'PROBLEM_COMMENT',
      targetId: 'problem-reply-1',
      metadata: {
        problemCode: 'khobau',
        problemId: 'problem-1',
        commentId: 'problem-reply-1',
        rootCommentId: 'problem-root-1',
      },
    })
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/problems/khobau?commentId=problem-reply-1&rootCommentId=problem-root-1')
    expect(mocks.request).toHaveBeenCalledWith(
      '/my/notifications/notification-1/read',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('still navigates if marking read fails without reporting a local read success', async () => {
    readFailure = new Error('offline')
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/discussions/discussion-1?commentId=reply-1&rootCommentId=root-1')
    expect(mocks.showToast).toHaveBeenCalledWith('offline')
  })

  it('preserves the existing CONTACT_REPLY destination', async () => {
    currentNotification = discussionNotification({
      type: 'CONTACT_REPLY',
      contactMessageId: 'contact-42',
      targetType: 'CONTACT_MESSAGE',
      targetId: 'contact-42',
      metadata: undefined,
    })
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/my/contact-messages/contact-42')
  })

  it('does not navigate to a target reported as unavailable', async () => {
    currentNotification = discussionNotification({ targetId: null, targetAvailable: false })
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/')
    expect(mocks.showToast).toHaveBeenCalledWith('discussionNotificationUnavailable')
  })

  it('does not navigate to an unavailable problem comment', async () => {
    currentNotification = discussionNotification({
      type: 'PROBLEM_REPLY',
      targetType: 'PROBLEM_COMMENT',
      targetId: null,
      targetAvailable: false,
      metadata: {
        problemCode: 'khobau',
        problemId: 'problem-1',
        commentId: 'deleted-reply',
        rootCommentId: 'problem-root-1',
      },
    })
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/')
    expect(mocks.showToast).toHaveBeenCalledWith('problemNotificationUnavailable')
  })

  it('rejects conflicting target and metadata comment ids', async () => {
    currentNotification = discussionNotification({
      metadata: {
        discussionId: 'discussion-1',
        commentId: 'different-reply',
        rootCommentId: 'root-1',
      },
    })
    await renderBell()
    await openNotificationList()
    await clickNotification()

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/')
    expect(mocks.showToast).toHaveBeenCalledWith('invalidNotificationLink')
    expect(mocks.request).not.toHaveBeenCalledWith(
      '/my/notifications/notification-1/read',
      expect.anything(),
    )
  })
})
