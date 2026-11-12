import { describe, expect, it } from 'vitest';
import {
  isNewsRichDocument,
  newsRichDocumentToMarkdown,
  NEWS_RICH_DOCUMENT_FORMAT,
  NEWS_RICH_DOCUMENT_VERSION,
  NEWS_RICH_MAX_JSON_BYTES,
} from './news-rich-content.js';

const document = (content: unknown[]) => ({
  format: NEWS_RICH_DOCUMENT_FORMAT,
  version: NEWS_RICH_DOCUMENT_VERSION,
  document: { type: 'doc', content },
});

describe('news rich content validation', () => {
  it('accepts version 1 documents with supported marks, headings, lists and images', () => {
    expect(
      isNewsRichDocument(
        document([
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'center' },
            content: [{ type: 'text', text: 'Thông báo', marks: [{ type: 'bold' }] }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'UTH',
                marks: [
                  { type: 'textStyle', attrs: { color: '#1565c0', fontSize: '18px' } },
                  { type: 'highlight', attrs: { color: '#fff176' } },
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://uth.edu.vn',
                      target: '_blank',
                      rel: 'noopener noreferrer nofollow',
                      class: null,
                    },
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [{ type: 'text', text: 'Default text alignment', marks: [{ type: 'highlight', attrs: { color: null } }] }],
          },
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Một mục' }] }] }],
          },
          {
            type: 'image',
            attrs: {
              src: '/news/media/123e4567-e89b-42d3-a456-426614174000',
              alt: 'Ảnh minh họa',
              width: 75,
              align: 'center',
            },
          },
        ]),
      ),
    ).toBe(true);
  });

  it('rejects unsupported versions, nodes, marks, attributes, heading levels and media URLs', () => {
    const invalidDocuments = [
      { ...document([]), version: 2 },
      document([{ type: 'script', attrs: { src: 'javascript:alert(1)' } }]),
      document([{ type: 'paragraph', attrs: { style: 'color:red' }, content: [] }]),
      document([{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Tiêu đề' }] }]),
      document([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'rawHtml' }] }] }]),
      document([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }]),
      document([{ type: 'image', attrs: { src: 'https://example.com/x.png', alt: 'x', width: 100, align: 'left' } }]),
      document([{ type: 'image', attrs: { src: '/news/media/123e4567-e89b-42d3-a456-426614174000', alt: 'x', width: 101, align: 'left' } }]),
    ];

    for (const candidate of invalidDocuments) expect(isNewsRichDocument(candidate)).toBe(false);
  });

  it('rejects overlong text, excessive nesting and oversized documents', () => {
    expect(isNewsRichDocument(document([{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(50_001) }] }]))).toBe(false);

    let nested: unknown = { type: 'text', text: 'deep' };
    nested = { type: 'paragraph', content: [nested] };
    for (let index = 0; index < 22; index += 1) {
      nested = { type: 'blockquote', content: [nested] };
    }
    expect(isNewsRichDocument(document([nested]))).toBe(false);

    expect(
      isNewsRichDocument(
        document([
          {
            type: 'paragraph',
            attrs: { unexpected: 'x'.repeat(NEWS_RICH_MAX_JSON_BYTES) },
            content: [{ type: 'text', text: 'small' }],
          },
        ]),
      ),
    ).toBe(false);
  });
});

describe('news rich content Markdown fallback', () => {
  it('generates supported Markdown while neutralizing user-authored Markdown and HTML syntax', () => {
    const fallback = newsRichDocumentToMarkdown(
      document([
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Tiêu đề **literal** <script>alert(1)</script>' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Nội dung', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com/a(b)' } }] }],
        },
        { type: 'image', attrs: { src: '/news/media/123e4567-e89b-42d3-a456-426614174000', alt: 'Ảnh **mẫu**', width: 50, align: 'right' } },
      ]),
    );

    expect(fallback).toContain('# Tiêu đề ∗∗literal∗∗ <\u200Bscript＞alert(1)<\u200B/script＞');
    expect(fallback).toContain('[**Nội dung**](https://example.com/a%28b%29)');
    expect(fallback).toContain('Image: Ảnh ∗∗mẫu∗∗');
    expect(fallback).not.toContain('<script>');
  });

  it('maps every supported heading level into the existing Markdown renderer range', () => {
    const fallback = newsRichDocumentToMarkdown(
      document(
        [2, 3, 4, 5, 6].map((level) => ({
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text: `Heading ${level}` }],
        })),
      ),
    );

    expect(fallback).toBe('# Heading 2\n\n## Heading 3\n\n### Heading 4\n\n### Heading 5\n\n### Heading 6');
  });

  it('rejects invalid documents instead of generating a success-shaped fallback', () => {
    expect(() => newsRichDocumentToMarkdown({ format: 'bad' })).toThrow('Cấu trúc nội dung Rich Text không hợp lệ.');
  });
});
