import { describe, expect, it } from 'vitest'
import { buildNewsCreatePayload, buildNewsPatchPayload } from './news-form-payload'
import { createEmptyNewsRichDocument, type NewsRichDocument } from './news-rich-content'
import type { NewsDraft } from './validation'

const draft: NewsDraft = {
  title: ' Tin tức mới ',
  slug: 'tin-tuc-moi',
  category: ' Thông báo ',
  summary: ' Tóm tắt ',
  content: '## Markdown cũ',
}

const richDocument: NewsRichDocument = {
  ...createEmptyNewsRichDocument(),
  document: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung Rich Text' }] }],
  },
}

describe('news form API payloads', () => {
  it('creates Rich Text with the backend envelope and never sends the Markdown fallback', () => {
    expect(buildNewsCreatePayload(draft, 'rich', richDocument)).toEqual({
      title: 'Tin tức mới',
      slug: 'tin-tuc-moi',
      category: 'Thông báo',
      summary: 'Tóm tắt',
      contentFormat: 'tiptap-json',
      contentJson: richDocument,
    })
  })

  it('keeps new Markdown articles on the existing content-only API shape', () => {
    expect(buildNewsCreatePayload(draft, 'markdown', richDocument)).toEqual({
      title: 'Tin tức mới',
      slug: 'tin-tuc-moi',
      category: 'Thông báo',
      summary: 'Tóm tắt',
      content: '## Markdown cũ',
    })
  })

  it('sends Rich JSON when content changes and omits all content fields for metadata-only edits', () => {
    expect(buildNewsPatchPayload(draft, 'rich', richDocument, true)).toEqual({
      title: 'Tin tức mới',
      slug: 'tin-tuc-moi',
      category: 'Thông báo',
      summary: 'Tóm tắt',
      contentFormat: 'tiptap-json',
      contentJson: richDocument,
    })
    expect(buildNewsPatchPayload(draft, 'rich', richDocument, false)).toEqual({
      title: 'Tin tức mới',
      slug: 'tin-tuc-moi',
      category: 'Thông báo',
      summary: 'Tóm tắt',
    })
  })
})
