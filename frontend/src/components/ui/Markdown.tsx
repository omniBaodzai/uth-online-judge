import type { ReactNode } from 'react'
import { parseMarkdown, type Inline } from '../../lib/markdown'
import styles from './Markdown.module.css'

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.value
      case 'code':
        return <code key={index}>{node.value}</code>
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>
      case 'em':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'link':
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children)}
          </a>
        )
    }
  })
}

function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4'
            return <Tag key={index}>{renderInline(block.children)}</Tag>
          }
          case 'paragraph':
            return <p key={index}>{renderInline(block.children)}</p>
          case 'quote':
            return <blockquote key={index}>{renderInline(block.children)}</blockquote>
          case 'code':
            return (
              <pre key={index}>
                <code>{block.value}</code>
              </pre>
            )
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul'
            return (
              <Tag key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </Tag>
            )
          }
        }
      })}
    </div>
  )
}

export default Markdown
