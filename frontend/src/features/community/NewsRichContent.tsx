import type { CSSProperties, ReactNode } from 'react'
import {
  getNewsRichDocumentIssue,
  isSafeNewsLink,
  NEWS_RICH_DOCUMENT_ISSUE_MESSAGES,
} from './news-rich-content'
import { apiBaseUrl } from '../auth/api'
import styles from './NewsRichContent.module.css'

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function renderInline(node: unknown, key: string): ReactNode {
  if (!isRecord(node)) return null
  if (node.type === 'hardBreak') return <br key={key} />
  if (node.type !== 'text' || typeof node.text !== 'string') return null

  let content: ReactNode = node.text
  for (const [index, mark] of values(node.marks).entries()) {
    if (!isRecord(mark)) continue
    const markKey = `${key}-mark-${index}`
    const attrs = isRecord(mark.attrs) ? mark.attrs : {}
    switch (mark.type) {
      case 'bold':
        content = <strong key={markKey}>{content}</strong>
        break
      case 'italic':
        content = <em key={markKey}>{content}</em>
        break
      case 'strike':
        content = <s key={markKey}>{content}</s>
        break
      case 'underline':
        content = <u key={markKey}>{content}</u>
        break
      case 'code':
        content = <code key={markKey}>{content}</code>
        break
      case 'link':
        if (typeof attrs.href === 'string' && isSafeNewsLink(attrs.href)) {
          const target = attrs.target === '_blank' ? '_blank' : attrs.target === '_self' ? '_self' : undefined
          const rel = target === '_blank' ? 'noopener noreferrer nofollow' : undefined
          content = <a key={markKey} href={attrs.href} target={target} rel={rel}>{content}</a>
        }
        break
      case 'highlight':
        content = (
          <mark
            key={markKey}
            style={typeof attrs.color === 'string' ? { backgroundColor: attrs.color } : undefined}
          >
            {content}
          </mark>
        )
        break
      case 'textStyle': {
        const style: CSSProperties = {}
        if (typeof attrs.color === 'string') style.color = attrs.color
        if (typeof attrs.fontSize === 'string') style.fontSize = attrs.fontSize
        content = <span key={markKey} style={style}>{content}</span>
        break
      }
    }
  }
  return <span key={key}>{content}</span>
}

function renderBlocks(nodes: unknown[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => renderBlock(node, `${keyPrefix}-${index}`))
}

function renderBlock(node: unknown, key: string): ReactNode {
  if (!isRecord(node) || typeof node.type !== 'string') return null
  const children = values(node.content)
  const attrs = isRecord(node.attrs) ? node.attrs : {}
  const textAlign =
    attrs.textAlign === 'left' || attrs.textAlign === 'center' ||
    attrs.textAlign === 'right' || attrs.textAlign === 'justify'
      ? attrs.textAlign
      : undefined
  const textStyle: CSSProperties | undefined = textAlign ? { textAlign } : undefined

  switch (node.type) {
    case 'paragraph':
      return <p key={key} style={textStyle}>{children.map((child, index) => renderInline(child, `${key}-${index}`))}</p>
    case 'heading': {
      const headings = { 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const
      const Tag = headings[Number(attrs.level) as keyof typeof headings]
      return Tag ? <Tag key={key} style={textStyle}>{children.map((child, index) => renderInline(child, `${key}-${index}`))}</Tag> : null
    }
    case 'blockquote':
      return <blockquote key={key}>{renderBlocks(children, key)}</blockquote>
    case 'bulletList':
      return <ul key={key}>{renderBlocks(children, key)}</ul>
    case 'orderedList':
      return <ol key={key} start={typeof attrs.start === 'number' ? attrs.start : undefined}>{renderBlocks(children, key)}</ol>
    case 'listItem':
      return <li key={key}>{renderBlocks(children, key)}</li>
    case 'codeBlock':
      return <pre key={key}><code>{children.map((child) => isRecord(child) && typeof child.text === 'string' ? child.text : '')}</code></pre>
    case 'horizontalRule':
      return <hr key={key} />
    case 'image': {
      const width = typeof attrs.width === 'number' ? `${attrs.width}%` : '100%'
      const source =
        typeof attrs.src === 'string' && attrs.src.startsWith('/news/media/')
          ? `${apiBaseUrl}${attrs.src}`
          : ''
      const alignment = attrs.align === 'left' || attrs.align === 'right' ? attrs.align : 'center'
      const alignmentClass =
        alignment === 'left' ? styles.imageLeft : alignment === 'right' ? styles.imageRight : styles.imageCenter
      return (
        <figure key={key} className={`${styles.image} ${alignmentClass}`}>
          <img
            src={source}
            alt={typeof attrs.alt === 'string' ? attrs.alt : ''}
            title={typeof attrs.title === 'string' ? attrs.title : undefined}
            loading="lazy"
            style={{ width }}
          />
        </figure>
      )
    }
    default:
      return null
  }
}

function NewsRichContent({ document }: { document: unknown }) {
  const issue = getNewsRichDocumentIssue(document)
  if (issue) return <p className={styles.error} role="alert">{NEWS_RICH_DOCUMENT_ISSUE_MESSAGES[issue]}</p>
  if (!isRecord(document) || !isRecord(document.document)) {
    return <p className={styles.error} role="alert">{NEWS_RICH_DOCUMENT_ISSUE_MESSAGES['invalid-document']}</p>
  }

  return <div className={styles.content}>{renderBlocks(values(document.document.content), 'block')}</div>
}

export default NewsRichContent
