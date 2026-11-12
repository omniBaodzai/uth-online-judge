// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SiteHeader from './SiteHeader'
import styles from './SiteHeader.module.css'

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  language: 'vi',
  logout: vi.fn(),
  mode: 'light',
  setMode: vi.fn(),
  showToast: vi.fn(),
  user: null as null | { id: string; username: string; email: string; avatar_url: null },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: mocks.language },
  }),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    isLoading: false,
    logout: mocks.logout,
  }),
}))

vi.mock('../../theme/useTheme', () => ({
  useTheme: () => ({
    mode: mocks.mode,
    resolvedTheme: 'light',
    setMode: mocks.setMode,
  }),
}))

vi.mock('../../i18n', () => ({
  changeLanguage: mocks.changeLanguage,
}))

vi.mock('../../features/profile/components/UserAvatar', () => ({
  default: () => <span aria-hidden="true">avatar</span>,
}))

vi.mock('./notifications/NotificationBell', () => ({
  default: () => <button type="button" aria-label="notification-bell" />,
}))

vi.mock('./ChangePasswordDialog', () => ({
  default: () => <div data-testid="password-dialog" />,
}))

vi.mock('../ui/toast-context', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

function LocationOutput() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.language = 'vi'
  mocks.mode = 'light'
  mocks.user = null
  mocks.logout.mockResolvedValue(undefined)
  mocks.changeLanguage.mockResolvedValue(undefined)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderHeader(initialEntry = '/') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <SiteHeader />
        <LocationOutput />
      </MemoryRouter>,
    )
  })
}

function getAppearanceControls() {
  return container.getElementsByClassName(styles.appearanceControls)
}

async function openAccountMenu() {
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="accountMenu"]')
  expect(trigger).not.toBeNull()
  await act(async () => trigger?.click())
  return trigger as HTMLButtonElement
}

describe('SiteHeader appearance controls', () => {
  it('keeps guest controls in the navigation and does not show an account menu', async () => {
    await renderHeader()

    expect(getAppearanceControls()).toHaveLength(1)
    expect(container.querySelector('[aria-label="accountMenu"]')).toBeNull()
    expect(container.querySelector('a[href="/register"]')).not.toBeNull()
    expect(container.querySelector('a[href="/login"]')).not.toBeNull()
  })

  it('renders one controls row in the authenticated account menu after edit profile', async () => {
    mocks.user = {
      id: 'user-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
    }
    await renderHeader()

    expect(getAppearanceControls()).toHaveLength(0)
    expect(container.querySelector('[aria-label="notification-bell"]')).not.toBeNull()
    const trigger = await openAccountMenu()
    const menu = container.querySelector<HTMLElement>('#account-menu')
    expect(menu).not.toBeNull()

    const children = [...(menu as HTMLElement).children]
    const editProfileIndex = children.findIndex((child) => child.textContent?.includes('editProfile'))
    const firstDividerIndex = children.findIndex((child) => child.classList.contains(styles.appearanceDivider))
    const controlsIndex = children.findIndex((child) => child.classList.contains(styles.appearanceControls))
    const dividers = [...(menu as HTMLElement).getElementsByClassName(styles.appearanceDivider)]
    const secondDividerIndex = children.findIndex((child, index) => (
      index > controlsIndex && child.classList.contains(styles.appearanceDivider)
    ))
    const logoutIndex = children.findIndex((child) => child.textContent?.includes('logout'))
    expect(editProfileIndex).toBeGreaterThanOrEqual(0)
    expect(firstDividerIndex).toBe(editProfileIndex + 1)
    expect(controlsIndex).toBe(firstDividerIndex + 1)
    expect(dividers).toHaveLength(2)
    expect(secondDividerIndex).toBe(controlsIndex + 1)
    expect(logoutIndex).toBe(secondDividerIndex + 1)

    const controls = getAppearanceControls()[0]
    expect(controls?.querySelectorAll('button')).toHaveLength(2)
    expect(controls?.querySelector('[aria-label="selectTheme: themeLight"]')).not.toBeNull()
    expect(controls?.querySelector('[aria-label="selectTheme: themeLight"]')?.textContent).toContain('theme')
    expect(controls?.querySelector('[aria-label="selectLanguage: languageVietnamese"]')?.textContent).toBe('VI')
    expect(getAppearanceControls()).toHaveLength(1)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('applies theme and language changes without closing the account menu', async () => {
    mocks.user = {
      id: 'user-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
    }
    await renderHeader()
    await openAccountMenu()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="selectTheme: themeLight"]')?.click()
    })
    expect(mocks.setMode).toHaveBeenCalledWith('dark')
    expect(container.querySelector('#account-menu')).not.toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="selectLanguage: languageVietnamese"]')?.click()
    })
    expect(mocks.changeLanguage).toHaveBeenCalledWith('en')
    expect(container.querySelector('#account-menu')).not.toBeNull()
    expect(mocks.logout).not.toHaveBeenCalled()
  })

  it('closes on outside click and restores focus after Escape', async () => {
    mocks.user = {
      id: 'user-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
    }
    await renderHeader()
    const trigger = await openAccountMenu()

    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(container.querySelector('#account-menu')).toBeNull()

    await openAccountMenu()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(container.querySelector('#account-menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps notification and account actions available', async () => {
    mocks.user = {
      id: 'user-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
    }
    await renderHeader()
    await openAccountMenu()

    expect(container.querySelector('[aria-label="notification-bell"]')).not.toBeNull()
    expect(container.querySelector('a[href="/profile"]')).not.toBeNull()
    expect(container.querySelector('a[href="/profile/edit"]')).not.toBeNull()

    await act(async () => {
      [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('changePassword'))?.click()
    })
    expect(container.querySelector('#account-menu')).toBeNull()
    expect(container.querySelector('[data-testid="password-dialog"]')).not.toBeNull()
  })

  it('navigates through profile links and logs out only from the logout action', async () => {
    mocks.user = {
      id: 'user-1',
      username: 'student',
      email: 'student@example.test',
      avatar_url: null,
    }
    await renderHeader('/problems')
    await openAccountMenu()

    await act(async () => {
      container.querySelector<HTMLAnchorElement>('a[href="/profile"]')?.click()
    })
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/profile')
    expect(container.querySelector('#account-menu')).toBeNull()

    await openAccountMenu()
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('logout'))
        ?.click()
      await Promise.resolve()
    })
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/')
    expect(container.querySelector('#account-menu')).toBeNull()
  })
})
