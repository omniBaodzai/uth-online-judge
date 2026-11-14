// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewsRichTextEditor from './NewsRichTextEditor'
import { createEmptyNewsRichDocument } from '../../community/news-rich-content'

const mockAuth = vi.hoisted(() => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => mockAuth,
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  mockAuth.request.mockResolvedValue({
    id: 'a4a4b748-a323-4d3a-8f76-3d72d1cb9812',
    url: '/news/media/a4a4b748-a323-4d3a-8f76-3d72d1cb9812',
    width: 20,
    height: 12,
  })
  mockAuth.requestBlob.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('NewsRichTextEditor', () => {
  it('renders accessible formatting controls and toggles an editing preview', async () => {
    await act(async () => {
      root.render(<NewsRichTextEditor onChange={vi.fn()} />)
    })

    expect(container.querySelector('[role="toolbar"][aria-label="Định dạng nội dung Rich Text"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="In đậm"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Tăng cỡ chữ"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Hoàn tác"]')?.hasAttribute('disabled')).toBe(true)
    expect(container.querySelector('button[aria-label="Chèn ảnh từ thiết bị"]')?.hasAttribute('disabled')).toBe(false)

    const boldButton = container.querySelector<HTMLButtonElement>('button[aria-label="In đậm"]')
    await act(async () => boldButton?.click())
    expect(boldButton?.getAttribute('aria-pressed')).toBe('true')

    const previewButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Xem trước')
    expect(previewButton).toBeDefined()
    await act(async () => previewButton?.click())

    expect(container.querySelector('#news-rich-content')?.getAttribute('contenteditable')).toBe('false')
    expect(container.querySelector('button[aria-label="In đậm"]')?.hasAttribute('disabled')).toBe(true)

    const editButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Tiếp tục chỉnh sửa')
    await act(async () => editButton?.click())
    expect(container.querySelector('#news-rich-content')?.getAttribute('contenteditable')).toBe('true')
  })

  it('hydrates a saved Rich Text document without changing its content on mount', async () => {
    const onChange = vi.fn()
    const initialValue = {
      ...createEmptyNewsRichDocument(),
      document: {
        type: 'doc' as const,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Đã lưu', marks: [{ type: 'bold' }] }],
        }],
      },
    }

    await act(async () => {
      root.render(<NewsRichTextEditor initialValue={initialValue} onChange={onChange} />)
    })

    const editor = container.querySelector('#news-rich-content')
    expect(editor?.textContent).toBe('Đã lưu')
    expect(editor?.querySelector('strong')?.textContent).toBe('Đã lưu')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('inserts a selected local image at the active editor selection', async () => {
    const onChange = vi.fn()
    await act(async () => {
      root.render(<NewsRichTextEditor onChange={onChange} />)
    })

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Chèn ảnh từ thiết bị"]')
    await act(async () => button?.click())
    const fileInput = container.querySelector<HTMLInputElement>('input[aria-label="Chọn ảnh tin tức"]')
    await act(async () => {
      if (!fileInput) return
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [new File(['image'], 'campus.png', { type: 'image/png' })],
      })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(onChange.mock.lastCall?.[0].document.content).toContainEqual(
      expect.objectContaining({
        type: 'image',
        attrs: expect.objectContaining({
          src: '/news/media/a4a4b748-a323-4d3a-8f76-3d72d1cb9812',
          alt: 'Ảnh tin tức',
          width: 100,
          align: 'center',
        }),
      }),
    )
  })

  it('lets an author resize, align, replace, and remove a selected image', async () => {
    const onChange = vi.fn()
    const initialValue = {
      ...createEmptyNewsRichDocument(),
      document: {
        type: 'doc' as const,
        content: [{
          type: 'image',
          attrs: {
            src: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
            alt: 'Campus',
            width: 100,
            align: 'center',
          },
        }],
      },
    }

    await act(async () => {
      root.render(<NewsRichTextEditor initialValue={initialValue} onChange={onChange} />)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const image = container.querySelector<HTMLImageElement>('[data-news-image="true"] img')
    expect(image).not.toBeNull()
    await act(async () => {
      image?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      image?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const slider = container.querySelector<HTMLInputElement>('input[aria-label="Chiều rộng ảnh theo phần trăm"]')
    expect(slider).not.toBeNull()
    await act(async () => {
      if (!slider) return
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!setValue) throw new Error('Range input value setter is unavailable')
      setValue.call(slider, '58')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange.mock.lastCall?.[0].document.content[0]).toMatchObject({
      attrs: { width: 58 },
    })

    const alignRight = container.querySelector<HTMLButtonElement>('button[aria-label="Căn ảnh phải"]')
    await act(async () => alignRight?.click())
    expect(onChange.mock.lastCall?.[0].document.content[0]).toMatchObject({
      attrs: { align: 'right' },
    })

    const replaceInput = container.querySelector<HTMLInputElement>('input[aria-label="Chọn ảnh thay thế"]')
    expect(replaceInput).not.toBeNull()
    await act(async () => {
      if (!replaceInput) return
      Object.defineProperty(replaceInput, 'files', {
        configurable: true,
        value: [new File(['replacement'], 'replacement.png', { type: 'image/png' })],
      })
      replaceInput.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(onChange.mock.lastCall?.[0].document.content[0]).toMatchObject({
      attrs: { src: '/news/media/a4a4b748-a323-4d3a-8f76-3d72d1cb9812' },
    })

    const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="Xóa ảnh khỏi bài viết"]')
    await act(async () => deleteButton?.click())
    expect(container.querySelector('[data-news-image="true"]')).toBeNull()
  })

})
