// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordDialog from './ChangePasswordDialog'

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  request: vi.fn(),
  setInitialPassword: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    const translations: Record<string, string> = {
      passwordSetupTitle: 'Thiết lập mật khẩu',
      passwordChangeTitle: 'Đổi mật khẩu',
      processing: 'Đang xử lý',
    }
    const t = (key: string) => translations[key] ?? key
    return () => ({ t })
  })(),
}))

vi.mock('../../features/auth/useAuth', () => ({
  useAuth: () => ({
    changePassword: mocks.changePassword,
    setInitialPassword: mocks.setInitialPassword,
    request: mocks.request,
  }),
}))

vi.mock('../../features/auth/components/PasswordStrengthMeter', () => ({
  default: () => null,
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.request.mockResolvedValue({ hasPassword: false })
  mocks.setInitialPassword.mockResolvedValue(undefined)
  mocks.changePassword.mockResolvedValue(undefined)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderDialog() {
  await act(async () => {
    root.render(<ChangePasswordDialog onClose={mocks.onClose} onSuccess={mocks.onSuccess} />)
  })
}

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('ChangePasswordDialog initial password setup', () => {
  it('sets an OAuth password directly without requesting or verifying an OTP', async () => {
    await renderDialog()

    expect(document.body.textContent).toContain('Thiết lập mật khẩu')
    expect(document.body.textContent).toContain('Đổi mật khẩu')
    expect(document.body.querySelector('input[name="otp"]')).toBeNull()

    const newPassword = document.body.querySelector<HTMLInputElement>('input[name="newPassword"]')
    const confirmPassword = document.body.querySelector<HTMLInputElement>('input[name="confirmPassword"]')
    const submit = [...document.body.querySelectorAll<HTMLButtonElement>('button[type="submit"]')]
      .find((button) => button.textContent?.includes('Đổi mật khẩu'))
    expect(newPassword).not.toBeNull()
    expect(confirmPassword).not.toBeNull()
    expect(submit).toBeDefined()
    if (!newPassword || !confirmPassword || !submit) {
      throw new Error('Password setup controls were not rendered.')
    }

    await act(async () => {
      setValue(newPassword, 'new-secure-password')
      setValue(confirmPassword, 'new-secure-password')
      submit.click()
    })

    expect(mocks.setInitialPassword).toHaveBeenCalledWith({
      newPassword: 'new-secure-password',
    })
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.request).toHaveBeenCalledWith('/auth/me/password-status')
    expect(mocks.changePassword).not.toHaveBeenCalled()
    expect(mocks.onSuccess).toHaveBeenCalledOnce()
  })

  it('keeps the existing current-password flow for accounts that already have a password', async () => {
    mocks.request.mockResolvedValue({ hasPassword: true })
    await renderDialog()

    const currentPassword = document.body.querySelector<HTMLInputElement>('input[name="currentPassword"]')
    const newPassword = document.body.querySelector<HTMLInputElement>('input[name="newPassword"]')
    const confirmPassword = document.body.querySelector<HTMLInputElement>('input[name="confirmPassword"]')
    const submit = [...document.body.querySelectorAll<HTMLButtonElement>('button[type="submit"]')]
      .find((button) => button.textContent?.includes('Đổi mật khẩu'))
    expect(currentPassword).not.toBeNull()
    expect(newPassword).not.toBeNull()
    expect(confirmPassword).not.toBeNull()
    expect(submit).toBeDefined()
    if (!currentPassword || !newPassword || !confirmPassword || !submit) {
      throw new Error('Password change controls were not rendered.')
    }

    await act(async () => {
      setValue(currentPassword, 'current-password')
      setValue(newPassword, 'new-secure-password')
      setValue(confirmPassword, 'new-secure-password')
      submit.click()
    })

    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'new-secure-password',
    })
    expect(mocks.setInitialPassword).not.toHaveBeenCalled()
    expect(mocks.onSuccess).toHaveBeenCalledOnce()
  })
})
