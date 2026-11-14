// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../auth/api'
import type { NewsArticle } from '../../community/api'
import { createEmptyNewsRichDocument } from '../../community/news-rich-content'
import type { NewsRichDocument } from '../../community/news-rich-content'
import AdminNewsFormPage from './AdminNewsFormPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  setNotice: vi.fn(),
  richDocument: {
    format: 'uth-news-rich-text' as const,
    version: 1 as const,
    document: {
      type: 'doc' as const,
      content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Nội dung Rich' }] }],
    },
  },
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ request: mocks.request, setNotice: mocks.setNotice }),
}))

vi.mock('../components/NewsRichTextEditor', () => ({
  default: ({ onChange }: { onChange: (value: NewsRichDocument) => void }) => (
    <button type="button" onClick={() => onChange(mocks.richDocument)}>Thay đổi nội dung Rich test</button>
  ),
}))

let container: HTMLDivElement
let root: Root

function article(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'article-id',
    slug: 'tin-tuc',
    title: 'Tin tức cũ',
    summary: 'Tóm tắt cũ',
    category: 'Thông báo',
    authorName: 'Admin',
    publishedAt: null,
    content: 'Nội dung Markdown cũ',
    contentFormat: 'markdown',
    contentJson: null,
    status: 'DRAFT',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function renderForm(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/news/new" element={<AdminNewsFormPage />} />
          <Route path="/admin/news/:id/edit" element={<AdminNewsFormPage />} />
          <Route path="/admin/news" element={<p>News list</p>} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

function setField(id: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)
  if (!field) throw new Error(`Missing form field: ${id}`)
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

async function fillRequiredFields() {
  await act(async () => {
    setField('news-title', 'Tin tức mới')
    setField('news-summary', 'Tóm tắt tin')
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.request.mockReset()
  mocks.setNotice.mockReset()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('AdminNewsFormPage Rich Text API integration', () => {
  it('defaults new articles to Rich Text and publishes through the separate status endpoint', async () => {
    const saved = article({ contentFormat: 'tiptap-json', contentJson: mocks.richDocument })
    mocks.request
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce({ ...saved, status: 'PUBLISHED' })

    await renderForm('/admin/news/new')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    expect([...container.querySelectorAll<HTMLButtonElement>('button')].some((button) => (
      button.textContent === 'Markdown' || button.textContent === 'Rich Text'
    ))).toBe(false)
    expect(container.querySelector('#news-content')).toBeNull()
    const unloadEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unloadEvent)
    expect(unloadEvent.defaultPrevented).toBe(false)

    await fillRequiredFields()
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Thay đổi nội dung Rich test')
        ?.click()
    })
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Lưu và xuất bản')
        ?.click()
    })

    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(mocks.request.mock.calls[0][0]).toBe('/admin/news')
    expect(mocks.request.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({
      title: 'Tin tức mới',
      category: 'Thông báo',
      summary: 'Tóm tắt tin',
      contentFormat: 'tiptap-json',
      contentJson: mocks.richDocument,
    })
    expect(mocks.request.mock.calls[1][0]).toBe('/admin/news/article-id/status')
    expect(JSON.parse(mocks.request.mock.calls[1][1].body)).toEqual({ status: 'PUBLISHED' })
  })

  it('keeps a legacy Markdown article in Markdown and omits unchanged content from metadata PATCH', async () => {
    const oldContent = '  ## Nội dung Markdown cũ  \n'
    const markdownArticle = article({ content: oldContent })
    mocks.request
      .mockResolvedValueOnce(markdownArticle)
      .mockResolvedValueOnce(markdownArticle)

    await renderForm('/admin/news/article-id/edit')
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

    const content = container.querySelector<HTMLTextAreaElement>('#news-content')
    expect(content?.value).toBe(oldContent)
    expect([...container.querySelectorAll<HTMLButtonElement>('button')].some((button) => (
      button.textContent === 'Markdown' || button.textContent === 'Rich Text'
    ))).toBe(false)

    await act(async () => {
      setField('news-title', 'Tiêu đề cập nhật')
    })
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())

    const patch = mocks.request.mock.calls.find(([path, init]) => path === '/admin/news/article-id' && init?.method === 'PATCH')
    expect(patch).toBeDefined()
    expect(JSON.parse(patch?.[1].body as string)).toEqual({
      title: 'Tiêu đề cập nhật',
      slug: 'tin-tuc',
      category: 'Thông báo',
      summary: 'Tóm tắt cũ',
    })
  })

  it('explains when the backend rejects Rich Text fields as unsupported', async () => {
    mocks.request.mockRejectedValueOnce(new ApiError('property contentFormat should not exist', 400))

    await renderForm('/admin/news/new')
    await fillRequiredFields()
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent === 'Thay đổi nội dung Rich test')
        ?.click()
    })
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Backend từ chối Rich Text')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('property contentFormat should not exist')
  })

  it('preserves Rich JSON by sending metadata-only PATCH when the editor content is unchanged', async () => {
    const document: NewsRichDocument = {
      ...createEmptyNewsRichDocument(),
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Giữ nguyên định dạng' }] }],
      },
    }
    const richArticle = article({ contentFormat: 'tiptap-json', contentJson: document })
    mocks.request
      .mockResolvedValueOnce(richArticle)
      .mockResolvedValueOnce(richArticle)

    await renderForm('/admin/news/article-id/edit')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      setField('news-title', 'Tiêu đề đã cập nhật')
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
      await Promise.resolve()
    })

    const patch = mocks.request.mock.calls.find(([path, init]) => path === '/admin/news/article-id' && init?.method === 'PATCH')
    expect(patch).toBeDefined()
    expect(JSON.parse(patch?.[1].body as string)).toEqual({
      title: 'Tiêu đề đã cập nhật',
      slug: 'tin-tuc',
      category: 'Thông báo',
      summary: 'Tóm tắt cũ',
    })
    expect(JSON.parse(patch?.[1].body as string)).not.toHaveProperty('contentJson')
    expect(JSON.parse(patch?.[1].body as string)).not.toHaveProperty('content')
  })
})
