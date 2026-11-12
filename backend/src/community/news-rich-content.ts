import { BadRequestException } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export const NEWS_RICH_CONTENT_FORMAT = 'tiptap-json' as const;
export const NEWS_RICH_DOCUMENT_FORMAT = 'uth-news-rich-text' as const;
export const NEWS_RICH_DOCUMENT_VERSION = 1 as const;
export const NEWS_RICH_MAX_JSON_BYTES = 1_048_576;
export const NEWS_RICH_MAX_TEXT_LENGTH = 50_000;
export const NEWS_RICH_MAX_DEPTH = 20;
export const NEWS_RICH_MAX_NODES = 10_000;
export const NEWS_RICH_MAX_BLOCKS = 2_000;

export type NewsContentFormat = 'markdown' | typeof NEWS_RICH_CONTENT_FORMAT;
export type NewsRichDocument = {
  format: typeof NEWS_RICH_DOCUMENT_FORMAT;
  version: typeof NEWS_RICH_DOCUMENT_VERSION;
  document: {
    type: 'doc';
    content: unknown[];
  };
};

const MARKS_WITHOUT_ATTRIBUTES = new Set(['bold', 'italic', 'strike', 'underline', 'code']);
const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const IMAGE_ALIGNMENTS = new Set(['left', 'center', 'right']);
const FONT_SIZES = new Set(['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']);
const COLOR_PATTERN = /^#[\da-f]{6}$/i;
const MEDIA_URL_PATTERN = /^\/news\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const MARKDOWN_LITERAL_MAP: Record<string, string> = {
  '*': '∗',
  '~': '∼',
  '+': '＋',
  '`': 'ˋ',
  '[': '［',
  ']': '］',
  '#': '＃',
  '>': '＞',
  '<': '<\u200B',
};

type ValidationState = { nodes: number; textLength: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isTextAlignment(value: unknown): boolean {
  return typeof value === 'string' && TEXT_ALIGNMENTS.has(value);
}

function containsUrlControlChars(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x20 || code === 0x7f;
  });
}

function isSafeLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || containsUrlControlChars(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return URL_PROTOCOLS.has(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateMarks(value: unknown, state: ValidationState): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 8) return false;

  return value.every((mark) => {
    if (!isRecord(mark) || typeof mark.type !== 'string') return false;
    state.nodes += 1;
    if (state.nodes > NEWS_RICH_MAX_NODES) return false;

    if (MARKS_WITHOUT_ATTRIBUTES.has(mark.type)) {
      return hasOnlyKeys(mark, ['type']);
    }

    if (mark.type === 'link') {
      if (!hasOnlyKeys(mark, ['type', 'attrs']) || !isRecord(mark.attrs)) return false;
      const { href, target, rel, class: className, title } = mark.attrs;
      return (
        hasOnlyKeys(mark.attrs, ['href', 'target', 'rel', 'class', 'title']) &&
        isSafeLink(href) &&
        (target === undefined || target === null || target === '_blank' || target === '_self') &&
        (rel === undefined ||
          rel === null ||
          rel === 'noopener noreferrer nofollow' ||
          rel === 'noopener noreferrer') &&
        (className === undefined || className === null) &&
        (title === undefined || title === null || (typeof title === 'string' && title.length <= 500))
      );
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
      );
    }

    if (mark.type === 'textStyle') {
      if (!hasOnlyKeys(mark, ['type', 'attrs']) || !isRecord(mark.attrs)) return false;
      const { color, fontSize } = mark.attrs;
      return (
        hasOnlyKeys(mark.attrs, ['color', 'fontSize']) &&
        (color === undefined || color === null || (typeof color === 'string' && COLOR_PATTERN.test(color))) &&
        (fontSize === undefined || fontSize === null || (typeof fontSize === 'string' && FONT_SIZES.has(fontSize))) &&
        (color != null || fontSize != null)
      );
    }

    return false;
  });
}

function validateInlineContent(value: unknown, depth: number, state: ValidationState): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((node) => validateNode(node, depth, state, 'inline'));
}

function validateBlockContent(value: unknown, depth: number, state: ValidationState): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((node) => validateNode(node, depth, state, 'block'));
}

function validateNode(
  value: unknown,
  depth: number,
  state: ValidationState,
  position: 'block' | 'inline' | 'list-item',
): boolean {
  if (!isRecord(value) || typeof value.type !== 'string' || depth > NEWS_RICH_MAX_DEPTH) return false;
  state.nodes += 1;
  if (state.nodes > NEWS_RICH_MAX_NODES) return false;

  switch (value.type) {
    case 'paragraph':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        (value.attrs === undefined || validateTextAlignAttrs(value.attrs, ['textAlign'])) &&
        (value.content === undefined || validateInlineContent(value.content, depth + 1, state))
      );
    case 'heading':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        isRecord(value.attrs) &&
        hasOnlyKeys(value.attrs, ['level', 'textAlign']) &&
        Number.isInteger(value.attrs.level) &&
        Number(value.attrs.level) >= 2 &&
        Number(value.attrs.level) <= 6 &&
        (value.attrs.textAlign === undefined ||
          value.attrs.textAlign === null ||
          isTextAlignment(value.attrs.textAlign)) &&
        validateInlineContent(value.content, depth + 1, state)
      );
    case 'blockquote':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        validateBlockContent(value.content, depth + 1, state)
      );
    case 'bulletList':
      return (
        position !== 'inline' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        validateListItems(value.content, depth + 1, state)
      );
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
      );
    case 'listItem':
      return (
        position === 'list-item' &&
        hasOnlyKeys(value, ['type', 'content']) &&
        Array.isArray(value.content) &&
        value.content.length > 0 &&
        value.content.every((node) => validateNode(node, depth + 1, state, 'block'))
      );
    case 'text':
      return (
        position === 'inline' &&
        hasOnlyKeys(value, ['type', 'text', 'marks']) &&
        typeof value.text === 'string' &&
        value.text.length > 0 &&
        !value.text.includes('\u0000') &&
        (state.textLength += value.text.length) <= NEWS_RICH_MAX_TEXT_LENGTH &&
        validateMarks(value.marks, state)
      );
    case 'hardBreak':
      return position === 'inline' && hasOnlyKeys(value, ['type']);
    case 'horizontalRule':
      return position !== 'inline' && hasOnlyKeys(value, ['type']);
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
            (state.textLength += node.text.length) <= NEWS_RICH_MAX_TEXT_LENGTH &&
            (state.nodes += 1) <= NEWS_RICH_MAX_NODES,
        )
      );
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
      );
    default:
      return false;
  }
}

function validateTextAlignAttrs(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, keys)) return false;
  return value.textAlign === undefined || value.textAlign === null || isTextAlignment(value.textAlign);
}

function validateListItems(value: unknown, depth: number, state: ValidationState): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((node) => validateNode(node, depth, state, 'list-item'));
}

export function isNewsRichDocument(value: unknown): value is NewsRichDocument {
  if (!isRecord(value) || !hasOnlyKeys(value, ['format', 'version', 'document'])) return false;
  if (
    value.format !== NEWS_RICH_DOCUMENT_FORMAT ||
    value.version !== NEWS_RICH_DOCUMENT_VERSION ||
    !isRecord(value.document) ||
    !hasOnlyKeys(value.document, ['type', 'content']) ||
    value.document.type !== 'doc' ||
    !Array.isArray(value.document.content) ||
    value.document.content.length > NEWS_RICH_MAX_BLOCKS
  ) {
    return false;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return false;
  }
  if (Buffer.byteLength(serialized, 'utf8') > NEWS_RICH_MAX_JSON_BYTES) return false;

  const state = { nodes: 1, textLength: 0 };
  return validateBlockContent(value.document.content, 1, state) && state.nodes <= NEWS_RICH_MAX_NODES;
}

export function newsRichImageIds(value: NewsRichDocument): string[] {
  const imageIds = new Set<string>();
  const visit = (node: unknown) => {
    if (!isRecord(node)) return;
    if (
      node.type === 'image' &&
      isRecord(node.attrs) &&
      typeof node.attrs.src === 'string'
    ) {
      const match = MEDIA_URL_PATTERN.exec(node.attrs.src);
      if (match) imageIds.add(match[0].slice('/news/media/'.length).toLowerCase());
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  value.document.content.forEach(visit);
  return [...imageIds];
}

@ValidatorConstraint({ name: 'newsRichDocument', async: false })
export class NewsRichDocumentConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isNewsRichDocument(value);
  }
}

function escapeMarkdownText(value: string): string {
  return value
    .replace(/[~*+`#<>]/g, (character) => MARKDOWN_LITERAL_MAP[character])
    .replaceAll('[', '［')
    .replaceAll(']', '］')
    .replace(/(^|\n)([ \t]*)-(?=\s)/g, '$1$2−')
    .replace(/(^|\n)([ \t]*\d+)[.)](?=\s)/g, '$1$2．');
}

function markdownHref(value: string): string {
  return value.replace(/[() ]/g, (character) => {
    if (character === '(') return '%28';
    if (character === ')') return '%29';
    return '%20';
  });
}

function serializeInline(node: Record<string, unknown>): string {
  if (node.type === 'hardBreak') return ' ';
  if (node.type !== 'text' || typeof node.text !== 'string') return '';

  let text = escapeMarkdownText(node.text);
  const marks = Array.isArray(node.marks) ? node.marks.filter(isRecord) : [];
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`;
        break;
      case 'italic':
        text = `*${text}*`;
        break;
      case 'strike':
        text = `~~${text}~~`;
        break;
      case 'underline':
        text = `++${text}++`;
        break;
      case 'code':
        text = `\`${text}\``;
        break;
      case 'link': {
        const attrs = isRecord(mark.attrs) ? mark.attrs : {};
        if (typeof attrs.href === 'string' && isSafeLink(attrs.href)) {
          text = `[${text}](${markdownHref(attrs.href)})`;
        }
        break;
      }
    }
  }
  return text;
}

function serializeBlock(node: Record<string, unknown>): string {
  const children = Array.isArray(node.content) ? node.content.filter(isRecord) : [];

  switch (node.type) {
    case 'paragraph':
      return children.map(serializeInline).join('');
    case 'heading': {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      const level = Number(attrs.level);
      const markdownLevel = Math.min(Math.max(level - 1, 1), 3);
      return `${'#'.repeat(markdownLevel)} ${children.map(serializeInline).join('')}`;
    }
    case 'blockquote':
      return children
        .map(serializeBlock)
        .join('\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    case 'bulletList':
    case 'orderedList':
      return children
        .flatMap((item, index) => {
          const itemChildren = Array.isArray(item.content) ? item.content.filter(isRecord) : [];
          const prefix = node.type === 'bulletList' ? '- ' : `${index + 1}. `;
          return itemChildren.map((child) =>
            serializeBlock(child)
              .split('\n')
              .map((line, lineIndex) => (lineIndex === 0 ? `${prefix}${line}` : `  ${line}`))
              .join('\n'),
          );
        })
        .join('\n');
    case 'image': {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      return typeof attrs.alt === 'string' ? `Image: ${escapeMarkdownText(attrs.alt)}` : '';
    }
    case 'horizontalRule':
      return '';
    case 'codeBlock':
      return children.map((child) => (typeof child.text === 'string' ? escapeMarkdownText(child.text) : '')).join('');
    default:
      return '';
  }
}

export function newsRichDocumentToMarkdown(value: unknown): string {
  if (!isNewsRichDocument(value)) {
    throw new BadRequestException('Cấu trúc nội dung Rich Text không hợp lệ.');
  }

  const markdown = value.document.content
    .filter(isRecord)
    .map(serializeBlock)
    .filter((block) => block.length > 0)
    .join('\n\n');
  if (!markdown.trim()) {
    throw new BadRequestException('Nội dung Rich Text phải có văn bản hoặc ảnh.');
  }
  return markdown;
}
