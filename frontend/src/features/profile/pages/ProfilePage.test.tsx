// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './ProfilePage'

const profileState = vi.hoisted(() => ({
  loading: true,
  error: '',
  profile: null,
  user: { id: 'profile-user', email: 'profile@example.test' },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: profileState.user,
    uploadCover: vi.fn(),
    updateProfile: vi.fn(),
  }),
}))

vi.mock('../../auth/components/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../usePublicProfile', () => ({
  usePublicProfile: () => ({
    profile: profileState.profile,
    loading: profileState.loading,
    error: profileState.error,
  }),
}))

vi.mock('../components/ProfileExperience', () => ({
  default: () => <div data-testid="profile-experience" />,
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  profileState.loading = true
  profileState.error = ''
  profileState.profile = null
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderProfile() {
  await act(async () => root.render(<ProfilePage />))
}

describe('ProfilePage loading feedback', () => {
  it('uses the shared fullscreen loader without the error feedback styling', async () => {
    await renderProfile()

    const status = document.body.querySelector('[data-loading-screen] [role="status"]')
    expect(status?.getAttribute('aria-label')).toBe('loadingProfile')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.getAttribute('aria-busy')).toBe('true')
    expect(container.inert).toBe(true)
    expect(container.querySelector('[class*="feedback"]')).toBeNull()
  })

  it('keeps actual profile load failures announced as errors', async () => {
    profileState.loading = false
    profileState.error = 'Could not load profile'

    await renderProfile()

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Could not load profile')
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
