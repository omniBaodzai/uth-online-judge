// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from './i18n'
import App from './App'

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  request: vi.fn(),
  isLoading: false,
  user: null as null | {
    id: string
    username: string
    email: string
    avatar_url: null
    role: 'STUDENT' | 'ADMIN'
  },
}))

vi.mock('./features/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('./features/auth/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    isLoading: mocks.isLoading,
    isAuthenticated: Boolean(mocks.user),
    initializationError: null,
    logout: mocks.logout,
    request: mocks.request,
    retrySession: vi.fn(),
  }),
}))

vi.mock('./theme/useTheme', () => ({
  useTheme: () => ({
    mode: 'system',
    resolvedTheme: 'light',
    setMode: vi.fn(),
  }),
}))

vi.mock('./components/layout/notifications/NotificationBell', () => ({
  default: () => <button type="button" aria-label="Notification bell" />,
}))

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  await i18n.changeLanguage('vi')
  vi.clearAllMocks()
  mocks.user = null
  mocks.isLoading = false
  mocks.request.mockResolvedValue({})
  document.title = 'UTH Online Judge'
  window.history.replaceState(null, '', '/not-a-real-route')
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderApp() {
  await act(async () => root.render(<App />))
  await vi.dynamicImportSettled()
  await act(async () => {})
}

describe('App wildcard route', () => {
  it('renders the not-found page inside the existing public layout without redirecting', async () => {
    await renderApp()

    expect(container.querySelector('main#main-content h1')?.textContent).toBe('Ối! Bạn đi lạc rồi!')
    expect(container.querySelector('header')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
    expect(window.location.pathname).toBe('/not-a-real-route')
    expect(container.querySelector('[aria-label="Menu tài khoản"]')).toBeNull()
  })

  it('allows authenticated visitors to use the same not-found layout', async () => {
    mocks.user = {
      id: 'student-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
      role: 'STUDENT',
    }
    await renderApp()

    expect(container.querySelector('main#main-content h1')?.textContent).toBe('Ối! Bạn đi lạc rồi!')
    expect(container.querySelector('[aria-label="Menu tài khoản"]')).not.toBeNull()
    expect(container.querySelector('header')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
  })

  it('uses the same approved client 404 for an unknown admin URL', async () => {
    window.history.replaceState(null, '', '/admin/no-such-route')
    await renderApp()

    expect(container.querySelector('main#main-content h1')?.textContent).toBe('Ối! Bạn đi lạc rồi!')
    expect(container.querySelector('header')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
  })

  it('continues to render an existing route instead of the wildcard', async () => {
    window.history.replaceState(null, '', '/login')
    await renderApp()

    expect(container.querySelector('form')).not.toBeNull()
    expect(container.querySelector('main#main-content h1')?.textContent).not.toBe('Ối! Bạn đi lạc rồi!')
  })

  it('keeps the authentication redirect for a directly loaded protected route', async () => {
    window.history.replaceState(null, '', '/problems/uth001/submit')
    await renderApp()

    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/problems/uth001/submit')
  })

  it('keeps the admin redirect for a directly loaded protected route', async () => {
    window.history.replaceState(null, '', '/admin/problems')
    await renderApp()

    expect(window.location.pathname).toBe('/admin/login')
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/admin/problems')
  })

  it('uses the fullscreen loader while a protected public route waits for session restoration', async () => {
    mocks.isLoading = true
    window.history.replaceState(null, '', '/problems/uth001/submit')
    await renderApp()

    const status = document.body.querySelector('[data-loading-screen] [role="status"]')
    expect(status?.getAttribute('aria-label')).toBe('Đang kiểm tra phiên đăng nhập')
    expect(container.inert).toBe(true)
    expect(container.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the fullscreen loader while Admin authorization is being restored', async () => {
    mocks.isLoading = true
    window.history.replaceState(null, '', '/admin/problems')
    await renderApp()

    const status = document.body.querySelector('[data-loading-screen] [role="status"]')
    expect(status?.getAttribute('aria-label')).toBe('Đang kiểm tra quyền quản trị…')
    expect(container.inert).toBe(true)
    expect(container.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps non-admin users on the existing permission-denied route state', async () => {
    mocks.user = {
      id: 'student-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
      role: 'STUDENT',
    }
    window.history.replaceState(null, '', '/admin')
    await renderApp()

    expect(container.textContent).toContain('Không có quyền quản trị')
    expect(window.location.pathname).toBe('/admin')
  })
})
