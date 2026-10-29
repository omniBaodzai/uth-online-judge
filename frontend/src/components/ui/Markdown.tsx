import type { ReactNode } from 'react'
import { parseMarkdown, type Inline } from '../../lib/markdown'
import styles from './Markdown.module.css'

const mathSymbols: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  cdot: '·',
  div: '÷',
  gamma: 'γ',
  ge: '≥',
  geq: '≥',
  in: '∈',
  infty: '∞',
  lambda: 'λ',
  le: '≤',
  leq: '≤',
  neq: '≠',
  notin: '∉',
  pi: 'π',
  pm: '±',
  rightarrow: '→',
  sqrt: '√',
  sum: '∑',
  theta: 'θ',
  times: '×',
}

const mathParts = /\\([a-zA-Z]+)|\^\{([^{}]+)\}|\^([+\-=0-9A-Za-z])|_\{([^{}]+)\}|_([+\-=0-9A-Za-z])/g

function renderMath(source: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of source.matchAll(mathParts)) {
    const index = match.index ?? 0
    if (index > lastIndex) nodes.push(source.slice(lastIndex, index))
    const command = match[1]
    const superscript = match[2] ?? match[3]
    const subscript = match[4] ?? match[5]

    if (command) {
      nodes.push(mathSymbols[command] ?? `\\${command}`)
    } else if (superscript) {
      nodes.push(<sup key={`sup-${index}`}>{superscript}</sup>)
    } else if (subscript) {
      nodes.push(<sub key={`sub-${index}`}>{subscript}</sub>)
    }
    lastIndex = index + match[0].length
  }
  if (lastIndex < source.length) nodes.push(source.slice(lastIndex))
  return nodes
}

function renderText(value: string): ReactNode {
  const result: ReactNode[] = []
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
  let lastIndex = 0
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) result.push(value.slice(lastIndex, index))
    const formula = match[0]
      .replace(/^\$\$|^\$|^\\\[|^\\\(/, '')
      .replace(/\$\$$|\$$|\\\]$|\\\)$/, '')
      .trim()
    result.push(
      <span className={styles.math} key={`math-${index}`}>
        {renderMath(formula)}
      </span>,
    )
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
