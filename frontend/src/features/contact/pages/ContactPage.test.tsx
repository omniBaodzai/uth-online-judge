// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactPage from './ContactPage'

const mocks = vi.hoisted(() => ({
  submitContactMessage: vi.fn(),
  getContactApiErrorMessage: vi.fn(),
  publicRequest: vi.fn(),
  authenticatedRequest: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; max?: number }) => {
      if (key === 'characterCount') return `${options?.count} / ${options?.max} ký tự`
      const translations: Record<string, string> = {
        supportGroup: 'Nhóm Zalo hỗ trợ',
        supportQrAlt: 'Mã QR nhóm Zalo hỗ trợ UTH Online Judge',
        supportQrInstruction: 'Quét mã QR để tham gia nhóm Zalo hỗ trợ.',
        contactNameRequired: 'contactNameRequired',
        contactEmailRequired: 'contactEmailRequired',
        contactSubjectRequired: 'contactSubjectRequired',
        contactMessageRequired: 'contactMessageRequired',
        contactSuccess: 'contactSuccess',
      }
      return translations[key] ?? key
    },
  }),
}))

vi.mock('../contact-api', () => ({
  submitContactMessage: mocks.submitContactMessage,
  getContactApiErrorMessage: mocks.getContactApiErrorMessage,
}))

vi.mock('../../auth/api', () => ({
  request: mocks.publicRequest,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ accessToken: null, request: mocks.authenticatedRequest }),
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.submitContactMessage.mockResolvedValue({ trackingAvailable: true })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderPage() {
  await act(async () => root.render(<ContactPage />))
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('ContactPage', () => {
  it('links the address to Maps and displays the provided Zalo QR without Telegram copy', async () => {
    await renderPage()

    const address = container.querySelector<HTMLAnchorElement>('a[href^="https://www.google.com/maps/search/"]')
    expect(address?.textContent).toBe('02 Võ Oanh, Phường Thạnh Mỹ Tây, Quận Bình Thạnh, Thành phố Hồ Chí Minh')
    expect(address?.target).toBe('_blank')
    expect(address?.rel).toBe('noopener noreferrer')

    const qr = container.querySelector<HTMLImageElement>('img[alt*="Mã QR"]')
    expect(qr?.getAttribute('src')).toContain('QR.jpg')
    expect(qr?.alt).toBe('Mã QR nhóm Zalo hỗ trợ UTH Online Judge')
    expect(container.textContent).toContain('Quét mã QR để tham gia nhóm Zalo hỗ trợ.')
    expect(container.textContent).not.toContain('Telegram')
    expect(container.textContent).not.toContain('Liên kết nhóm hỗ trợ chưa được cấu hình')
    expect(container.textContent).not.toContain('Fanpage chính thức · Cộng đồng lập trình UTH')
    expect(container.textContent).toContain('UTH Online Judge')
  })

  it('preserves validation, character count, and mocked form submission', async () => {
    await renderPage()

    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')
    const name = container.querySelector<HTMLInputElement>('input[name="name"]')
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')
    const subject = container.querySelector<HTMLInputElement>('input[name="subject"]')
    const message = container.querySelector<HTMLTextAreaElement>('textarea[name="message"]')
    expect(submitButton).not.toBeNull()
    expect(name).not.toBeNull()
    expect(email).not.toBeNull()
    expect(subject).not.toBeNull()
    expect(message).not.toBeNull()
    if (!submitButton || !name || !email || !subject || !message) {
      throw new Error('Contact form controls were not rendered.')
    }

    await act(async () => submitButton.click())
    expect(container.textContent).toContain('contactNameRequired')
    expect(mocks.submitContactMessage).not.toHaveBeenCalled()

    await act(async () => {
      setValue(name, ' Ada Lovelace ')
      setValue(email, ' ada@example.com ')
      setValue(subject, ' Help ')
      setValue(message, 'Need assistance')
    })
    expect(container.textContent).toContain('15 / 2000 ký tự')

    await act(async () => submitButton.click())
    expect(mocks.submitContactMessage).toHaveBeenCalledWith(
      mocks.publicRequest,
      {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        subject: 'Help',
        content: 'Need assistance',
      },
      expect.any(AbortSignal),
    )
    expect(container.textContent).toContain('contactSuccess')
  })
})
