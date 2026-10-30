import { useEffect, useRef, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { parseMarkdown, type Inline } from '../../lib/markdown'
import styles from './Markdown.module.css'

function MathExpression({ source, display }: { source: string; display: boolean }) {
  const element = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (element.current) {
      katex.render(source, element.current, {
        displayMode: display,
        throwOnError: false,
        trust: false,
      })
    }
  }, [display, source])

  return <span ref={element} className={display ? styles.mathDisplay : styles.math} aria-label={source} />
}

function renderText(value: string): ReactNode {
  const result: ReactNode[] = []
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
  let lastIndex = 0
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) result.push(value.slice(lastIndex, index))
    const source = match[0]
      .replace(/^\$\$|^\$|^\\\[|^\\\(/, '')
      .replace(/\$\$$|\$$|\\\]$|\\\)$/, '')
      .trim()
    const display = source.length > 0 && (/^\$\$|^\\\[/.test(match[0]))
    result.push(<MathExpression key={`math-${index}`} source={source} display={display} />)
    lastIndex = index + match[0].length
  }
  if (lastIndex < value.length) result.push(value.slice(lastIndex))
  return result
}

function renderInline(nodes: Inline[], math: boolean): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return math
          ? <span key={index}>{renderText(node.value)}</span>
          : node.value
      case 'code':
        return <code key={index}>{node.value}</code>
      case 'strong':
        return <strong key={index}>{renderInline(node.children, math)}</strong>
      case 'em':
        return <em key={index}>{renderInline(node.children, math)}</em>
      case 'strike':
        return <del key={index}>{renderInline(node.children, math)}</del>
      case 'underline':
        return <u key={index}>{renderInline(node.children, math)}</u>
      case 'link':
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children, math)}
          </a>
        )
    }
  })
}

function Markdown({
  source,
  className,
  math = false,
}: {
  source: string
  className?: string
  math?: boolean
}) {
  const blocks = parseMarkdown(source)
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4'
            return <Tag key={index}>{renderInline(block.children, math)}</Tag>
          }
          case 'paragraph':
            return <p key={index}>{renderInline(block.children, math)}</p>
          case 'quote':
            return <blockquote key={index}>{renderInline(block.children, math)}</blockquote>
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
                  <li key={itemIndex}>{renderInline(item, math)}</li>
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
