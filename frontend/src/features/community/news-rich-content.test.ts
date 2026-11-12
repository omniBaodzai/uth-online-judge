// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createEmptyNewsRichDocument,
  createNewsRichDocument,
  getNewsRichDocumentIssue,
  getNewsRendererMode,
  hasNewsRichContent,
  isNewsRichDocument,
  isSafeNewsLink,
  NEWS_RICH_DOCUMENT_FORMAT,
  NEWS_RICH_DOCUMENT_VERSION,
  NEWS_RICH_TEXT_EXTENSIONS,
} from './news-rich-content'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('news rich content contract', () => {
  it('creates a versioned envelope and serializes only the Tiptap document', () => {
    expect(createEmptyNewsRichDocument()).toEqual({
      format: NEWS_RICH_DOCUMENT_FORMAT,
      version: NEWS_RICH_DOCUMENT_VERSION,
      document: { type: 'doc', content: [{ type: 'paragraph' }] },
    })

    editor = new Editor({
      extensions: NEWS_RICH_TEXT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tin mới', marks: [{ type: 'bold' }] }] },
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{
              type: 'text',
              text: 'Đọc thêm',
              marks: [
                { type: 'textStyle', attrs: { color: '#123456', fontSize: '18px' } },
                { type: 'highlight', attrs: { color: '#fff29a' } },
                { type: 'link', attrs: { href: 'https://example.test', target: '_blank', rel: 'noopener noreferrer nofollow' } },
              ],
            }],
          },
        ],
      },
    })

    const result = createNewsRichDocument(editor.getJSON())
    expect(isNewsRichDocument(result), JSON.stringify(result)).toBe(true)
    expect(result.format).toBe('uth-news-rich-text')
    expect(result.version).toBe(1)
    expect(result.document.type).toBe('doc')
    expect(result.document.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Tin mới', marks: [{ type: 'bold' }] }],
    })
    expect(result.document.content[1]).toMatchObject({
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{
        type: 'text',
        text: 'Đọc thêm',
        marks: expect.arrayContaining([
          { type: 'textStyle', attrs: { color: '#123456', fontSize: '18px' } },
          { type: 'highlight', attrs: { color: '#fff29a' } },
          expect.objectContaining({ type: 'link', attrs: expect.objectContaining({ href: 'https://example.test' }) }),
        ]),
      }],
    })
  })

  it('rejects unsafe URLs and accepts the backend-supported protocols', () => {
    expect(isSafeNewsLink('https://example.test/news')).toBe(true)
    expect(isSafeNewsLink('mailto:editor@example.test')).toBe(true)
    expect(isSafeNewsLink('javascript:alert(1)')).toBe(false)
    expect(isSafeNewsLink('https://user:pass@example.test')).toBe(false)
    expect(isSafeNewsLink('https://example.test/\nunsafe')).toBe(false)
  })

  it('rejects invalid envelopes, unsupported versions, unsafe image paths and documents without content', () => {
    const empty = createEmptyNewsRichDocument()
    expect(getNewsRichDocumentIssue({ ...empty, version: 2 })).toBe('unsupported-version')
    expect(getNewsRichDocumentIssue({ ...empty, format: 'future-format' })).toBe('unsupported-format')
    expect(getNewsRichDocumentIssue({
      ...empty,
      document: {
        type: 'doc',
        content: [{
          type: 'image',
          attrs: { src: 'javascript:alert(1)', alt: 'x', width: 100, align: 'center' },
        }],
      },
    })).toBe('invalid-document')
    expect(hasNewsRichContent(empty)).toBe(false)
    expect(getNewsRendererMode(undefined)).toBe('markdown')
  })

  it('supports formatting, alignment, undo and redo with the configured schema', () => {
    editor = new Editor({ extensions: NEWS_RICH_TEXT_EXTENSIONS })
    editor.commands.insertContent('News')
    editor.commands.setTextSelection({ from: 1, to: 5 })
    editor.commands.toggleBold()
    editor.commands.setTextAlign('justify')

    expect(createNewsRichDocument(editor.getJSON()).document.content[0]).toMatchObject({
      type: 'paragraph',
      attrs: { textAlign: 'justify' },
      content: [{ type: 'text', text: 'News', marks: [{ type: 'bold' }] }],
    })
    expect(editor.can().undo()).toBe(true)
    expect(editor.commands.undo()).toBe(true)
    expect(editor.commands.redo()).toBe(true)
  })

  it('round-trips an image node without serializing null attributes', () => {
    editor = new Editor({
      extensions: NEWS_RICH_TEXT_EXTENSIONS,
      content: {
        type: 'doc',
        content: [{
          type: 'image',
          attrs: {
            src: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
            alt: 'Campus',
            title: null,
            width: 64,
            align: 'right',
          },
        }],
      },
    })

    const result = createNewsRichDocument(editor.getJSON())
    expect(isNewsRichDocument(result), JSON.stringify(result)).toBe(true)
    expect(result.document.content[0]).toEqual({
      type: 'image',
      attrs: {
        src: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
        alt: 'Campus',
        width: 64,
        align: 'right',
      },
    })
  })
})
