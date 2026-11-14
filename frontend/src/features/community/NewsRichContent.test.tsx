import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import NewsRichContent from './NewsRichContent'
import {
  getNewsRendererMode,
  NEWS_RICH_DOCUMENT_FORMAT,
  NEWS_RICH_DOCUMENT_VERSION,
} from './news-rich-content'

describe('NewsRichContent', () => {
  it('renders allowlisted nodes and marks as React elements', () => {
    const document = {
      format: NEWS_RICH_DOCUMENT_FORMAT,
      version: NEWS_RICH_DOCUMENT_VERSION,
      document: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tin mới', marks: [{ type: 'bold' }] }] },
          {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Xem chi tiết',
              marks: [
                { type: 'link', attrs: { href: 'https://example.test/article', target: '_blank', rel: 'noopener noreferrer nofollow' } },
                { type: 'textStyle', attrs: { color: '#123456', fontSize: '18px' } },
                { type: 'highlight', attrs: { color: '#fff29a' } },
              ],
            }],
          },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mục' }] }] }] },
        ],
      },
    }

    const html = renderToStaticMarkup(<NewsRichContent document={document} />)

    expect(html).toContain('<h2><span><strong>Tin mới</strong></span></h2>')
    expect(html).toContain('href="https://example.test/article"')
    expect(html).toContain('color:#123456')
    expect(html).toContain('background-color:#fff29a')
    expect(html).toContain('<ul><li><p>')
  })

  it('escapes untrusted text and rejects executable URLs without creating HTML', () => {
    const document = {
      format: NEWS_RICH_DOCUMENT_FORMAT,
      version: NEWS_RICH_DOCUMENT_VERSION,
      document: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: '<script>alert(1)</script><img src=x onerror=alert(1)>' }],
        }],
      },
    }

    const html = renderToStaticMarkup(<NewsRichContent document={document} />)
    const unsafeLink = {
      ...document,
      document: {
        ...document.document,
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'unsafe',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          }],
        }],
      },
    }
    const unsafeHtml = renderToStaticMarkup(<NewsRichContent document={unsafeLink} />)

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/<img\b/i)
    expect(unsafeHtml).toContain('Document Rich Text không hợp lệ')
    expect(unsafeHtml).not.toContain('href="javascript:')
  })

  it('reports an unsupported document version', () => {
    const html = renderToStaticMarkup(
      <NewsRichContent document={{
        format: NEWS_RICH_DOCUMENT_FORMAT,
        version: 2,
        document: { type: 'doc', content: [] },
      }} />,
    )

    expect(html).toContain('Phiên bản Rich Text này không được hỗ trợ')
  })

  it('renders only allowlisted media URLs against the API origin and retains resize/alignment', () => {
    const html = renderToStaticMarkup(
      <NewsRichContent document={{
        format: NEWS_RICH_DOCUMENT_FORMAT,
        version: NEWS_RICH_DOCUMENT_VERSION,
        document: {
          type: 'doc',
          content: [{
            type: 'image',
            attrs: {
              src: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
              alt: 'Campus',
              width: 64,
              align: 'right',
            },
          }],
        },
      }} />,
    )

    expect(html).toContain('/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812')
    expect(html).toContain('width:64%')
    expect(html).toContain('alt="Campus"')
    expect(html).toContain('imageRight')
  })

  it('keeps absent and Markdown formats on the legacy Markdown renderer path', () => {
    expect(getNewsRendererMode(undefined)).toBe('markdown')
    expect(getNewsRendererMode('markdown')).toBe('markdown')
    expect(getNewsRendererMode('tiptap-json')).toBe('rich')
    expect(getNewsRendererMode('future-format')).toBe('unsupported')
  })

})
