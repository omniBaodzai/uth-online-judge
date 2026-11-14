import { TextAlign } from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import FontSize from '@tiptap/extension-text-style/font-size'
import { StarterKit } from '@tiptap/starter-kit'
import type { Extensions, JSONContent } from '@tiptap/core'
import { NewsImage } from './news-image-extension'

export const NEWS_RICH_DOCUMENT_FORMAT = 'uth-news-rich-text' as const
export const NEWS_RICH_DOCUMENT_VERSION = 1 as const
export const NEWS_RICH_CONTENT_FORMAT = 'tiptap-json' as const
const MAX_JSON_BYTES = 1_048_576
const MAX_TEXT_LENGTH = 50_000
const MAX_DEPTH = 20
const MAX_NODES = 10_000
const MAX_BLOCKS = 2_000
const FONT_SIZES = new Set(['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'])
const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify'])
const IMAGE_ALIGNMENTS = new Set(['left', 'center', 'right'])
const COLOR_PATTERN = /^#[\da-f]{6}$/i
const MEDIA_URL_PATTERN = /^\/news\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MARKS_WITHOUT_ATTRIBUTES = new Set(['bold', 'italic', 'strike', 'underline', 'code'])

export type NewsRichDocument = {
  format: typeof NEWS_RICH_DOCUMENT_FORMAT
  version: typeof NEWS_RICH_DOCUMENT_VERSION
  document: { type: 'doc'; content: JSONContent[] }
}

export type NewsRichDocumentIssue =
  | 'invalid-envelope'
  | 'unsupported-format'
  | 'unsupported-version'
  | 'invalid-document'

export const NEWS_RICH_DOCUMENT_ISSUE_MESSAGES: Record<NewsRichDocumentIssue, string> = {
  'invalid-envelope': 'Bài viết có cấu trúc Rich Text không hợp lệ.',
  'unsupported-format': 'Định dạng Rich Text của bài viết không được hỗ trợ.',
  'unsupported-version': 'Phiên bản Rich Text này không được hỗ trợ. Hãy cập nhật hệ thống trước khi hiển thị bài viết.',
  'invalid-document': 'Document Rich Text không hợp lệ hoặc chứa định dạng chưa được hỗ trợ.',
}

export const NEWS_RICH_TEXT_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4, 5, 6] },
    link: {
      autolink: false,
      linkOnPaste: false,
      openOnClick: false,
      protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (uri) => isSafeNewsLink(uri),
    },
  }),
  TextStyle,
  Color,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right', 'justify'],
  }),
  NewsImage,
]

export function createEmptyNewsRichDocument(): NewsRichDocument {
  return {
    format: NEWS_RICH_DOCUMENT_FORMAT,
    version: NEWS_RICH_DOCUMENT_VERSION,
    document: { type: 'doc', content: [{ type: 'paragraph' }] },
  }
}

function sanitizeNewsRichNode(node: JSONContent): JSONContent {
  let attrs = node.attrs
  if (node.type === 'image' && attrs) {
    const imageAttrs = { ...attrs }
    delete imageAttrs.height
    if (imageAttrs.title === null) delete imageAttrs.title
    attrs = imageAttrs
  }
  return {
    ...node,
    ...(attrs ? { attrs } : {}),
    ...(node.content ? { content: node.content.map(sanitizeNewsRichNode) } : {}),
  }
}

export function createNewsRichDocument(document: JSONContent): NewsRichDocument {
  if (document.type !== 'doc' || !Array.isArray(document.content)) {
    throw new Error('Tiptap returned an invalid news document.')
  }

  return {
    format: NEWS_RICH_DOCUMENT_FORMAT,
    version: NEWS_RICH_DOCUMENT_VERSION,
    document: { type: 'doc', content: document.content.map(sanitizeNewsRichNode) },
  }
}

export function isSafeNewsLink(value: string): boolean {
  if (!value || value.length > 2048 || Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code <= 0x20 || code === 0x7f
  })) {
    return false
  }

  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

type ValidationState = { nodes: number; textLength: number }
type RichRecord = Record<string, unknown>
type RichPosition = 'block' | 'inline' | 'list-item'

function isRecord(value: unknown): value is RichRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: RichRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function validateTextAlignAttrs(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['textAlign'])) return false
  return value.textAlign === undefined || value.textAlign === null ||
    (typeof value.textAlign === 'string' && TEXT_ALIGNMENTS.has(value.textAlign))
}

function validateMarks(value: unknown, state: ValidationState): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > 8) return false

  return value.every((mark) => {
    if (!isRecord(mark) || typeof mark.type !== 'string') return false
    state.nodes += 1
    if (state.nodes > MAX_NODES) return false

    if (MARKS_WITHOUT_ATTRIBUTES.has(mark.type)) return hasOnlyKeys(mark, ['type'])
    if (mark.type === 'link') {
      if (!hasOnlyKeys(mark, ['type', 'attrs']) || !isRecord(mark.attrs)) return false
      const { href, target, rel, class: className, title } = mark.attrs
      return (
        hasOnlyKeys(mark.attrs, ['href', 'target', 'rel', 'class', 'title']) &&
        typeof href === 'string' &&
        isSafeNewsLink(href) &&
        (target === undefined || target === null || target === '_blank' || target === '_self') &&
        (rel === undefined || rel === null || rel === 'noopener noreferrer nofollow' || rel === 'noopener noreferrer') &&
        (className === undefined || className === null) &&
        (title === undefined || title === null || (typeof title === 'string' && title.length <= 500))
      )
    }
    if (mark.type === 'highlight') {
      return (
        hasOnlyKeys(mark, ['type', 'attrs']) &&
        (mark.attrs === undefined ||
          (isRecord(mark.attrs) &&
            hasOnlyKeys(mark.attrs, ['color']) &&
            (mark.attrs.color === undefined ||
              mark.attrs.color === null ||
              (typeof mark.attrs.color === 'string' && COLOR_PATTERN.test(mark.attrs.color)))))
      )
    }
    if (mark.type === 'textStyle') {
      if (!hasOnlyKeys(mark, ['type', 'attrs']) || !isRecord(mark.attrs)) return false
      const { color, fontSize } = mark.attrs
      return (
        hasOnlyKeys(mark.attrs, ['color', 'fontSize']) &&
        (color === undefined || color === null || (typeof color === 'string' && COLOR_PATTERN.test(color))) &&
        (fontSize === undefined || fontSize === null || (typeof fontSize === 'string' && FONT_SIZES.has(fontSize))) &&
        (color != null || fontSize != null)
      )
    }
    return false
  })
}

function validateNode(value: unknown, depth: number, state: ValidationState, position: RichPosition): boolean {
  if (!isRecord(value) || typeof value.type !== 'string' || depth > MAX_DEPTH) return false
  state.nodes += 1
  if (state.nodes > MAX_NODES) return false

  switch (value.type) {
    case 'paragraph':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        (value.attrs === undefined || validateTextAlignAttrs(value.attrs)) &&
        (value.content === undefined || validateInlineContent(value.content, depth + 1, state))
      )
    case 'heading': {
      if (!hasOnlyKeys(value, ['type', 'attrs', 'content']) || !isRecord(value.attrs)) return false
      const { level, textAlign } = value.attrs
      return (
        position !== 'inline' &&
        hasOnlyKeys(value.attrs, ['level', 'textAlign']) &&
        Number.isInteger(level) &&
        Number(level) >= 2 &&
        Number(level) <= 6 &&
        (textAlign === undefined || textAlign === null ||
          (typeof textAlign === 'string' && TEXT_ALIGNMENTS.has(textAlign))) &&
        validateInlineContent(value.content, depth + 1, state)
      )
    }
    case 'blockquote':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        validateBlockContent(value.content, depth + 1, state)
      )
    case 'bulletList':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        validateListItems(value.content, depth + 1, state)
      )
    case 'orderedList':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        (value.attrs === undefined ||
          (isRecord(value.attrs) &&
            hasOnlyKeys(value.attrs, ['start']) &&
            Number.isInteger(value.attrs.start) &&
            Number(value.attrs.start) >= 1 &&
            Number(value.attrs.start) <= 10_000)) &&
        validateListItems(value.content, depth + 1, state)
      )
    case 'listItem':
      return (
        position === 'list-item' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((node) => validateNode(node, depth + 1, state, 'block'))
      )
    case 'text':
      return (
        position === 'inline' &&
        hasOnlyKeys(value, ['type', 'text', 'marks']) &&
        typeof value.text === 'string' &&
        value.text.length > 0 &&
        !value.text.includes('\u0000') &&
        (state.textLength += value.text.length) <= MAX_TEXT_LENGTH &&
        validateMarks(value.marks, state)
      )
    case 'hardBreak':
      return position === 'inline' && hasOnlyKeys(value, ['type'])
    case 'horizontalRule':
      return position !== 'inline' && hasOnlyKeys(value, ['type'])
    case 'codeBlock':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        (value.attrs === undefined ||
          (isRecord(value.attrs) &&
            hasOnlyKeys(value.attrs, ['language']) &&
            (value.attrs.language === null ||
              (typeof value.attrs.language === 'string' && /^[a-z0-9+#.-]{1,32}$/i.test(value.attrs.language))))) &&
        Array.isArray(value.content) &&
        value.content.every(
          (node) =>
            isRecord(node) &&
            node.type === 'text' &&
            hasOnlyKeys(node, ['type', 'text']) &&
            typeof node.text === 'string' &&
            !node.text.includes('\u0000') &&
            (state.textLength += node.text.length) <= MAX_TEXT_LENGTH &&
            (state.nodes += 1) <= MAX_NODES,
        )
      )
    case 'image':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs']) &&
        isRecord(value.attrs) &&
        hasOnlyKeys(value.attrs, ['src', 'alt', 'title', 'width', 'align']) &&
        typeof value.attrs.src === 'string' &&
        MEDIA_URL_PATTERN.test(value.attrs.src) &&
        typeof value.attrs.alt === 'string' &&
        value.attrs.alt.trim().length > 0 &&
        value.attrs.alt.length <= 500 &&
        (value.attrs.title === undefined || (typeof value.attrs.title === 'string' && value.attrs.title.length <= 500)) &&
        Number.isInteger(value.attrs.width) &&
        Number(value.attrs.width) >= 25 &&
        Number(value.attrs.width) <= 100 &&
        typeof value.attrs.align === 'string' &&
        IMAGE_ALIGNMENTS.has(value.attrs.align)
      )
    default:
      return false
  }
}

function validateInlineContent(value: unknown, depth: number, state: ValidationState): boolean {
  return Array.isArray(value) && value.every((node) => validateNode(node, depth, state, 'inline'))
}

function validateBlockContent(value: unknown, depth: number, state: ValidationState): boolean {
  return Array.isArray(value) && value.every((node) => validateNode(node, depth, state, 'block'))
}

function validateListItems(value: unknown, depth: number, state: ValidationState): boolean {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((node) => validateNode(node, depth, state, 'list-item'))
}

export function getNewsRichDocumentIssue(value: unknown): NewsRichDocumentIssue | null {
  if (!isRecord(value)) return 'invalid-envelope'
  if (value.format !== NEWS_RICH_DOCUMENT_FORMAT) return 'unsupported-format'
  if (value.version !== NEWS_RICH_DOCUMENT_VERSION) return 'unsupported-version'
  if (
    !hasOnlyKeys(value, ['format', 'version', 'document']) ||
    !isRecord(value.document) ||
    !hasOnlyKeys(value.document, ['type', 'content']) ||
    value.document.type !== 'doc' ||
    !Array.isArray(value.document.content) ||
    value.document.content.length > MAX_BLOCKS
  ) {
    return 'invalid-document'
  }

  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    return 'invalid-document'
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_JSON_BYTES) return 'invalid-document'

  const state = { nodes: 1, textLength: 0 }
  return validateBlockContent(value.document.content, 1, state) && state.nodes <= MAX_NODES
    ? null
    : 'invalid-document'
}

export function isNewsRichDocument(value: unknown): value is NewsRichDocument {
  return getNewsRichDocumentIssue(value) === null
}

export function getNewsRendererMode(format: unknown): 'markdown' | 'rich' | 'unsupported' {
  if (format === undefined || format === 'markdown') return 'markdown'
  if (format === NEWS_RICH_CONTENT_FORMAT) return 'rich'
  return 'unsupported'
}

export function hasNewsRichContent(value: NewsRichDocument): boolean {
  const parts: string[] = []
  function collect(node: unknown) {
    if (!isRecord(node)) return
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
    if (node.type === 'image' && isRecord(node.attrs) && typeof node.attrs.alt === 'string') parts.push(node.attrs.alt)
    if (Array.isArray(node.content)) node.content.forEach(collect)
  }
  value.document.content.forEach(collect)
  return parts.join('').trim().length > 0
}
