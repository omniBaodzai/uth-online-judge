import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import python from 'highlight.js/lib/languages/python'
import 'highlight.js/styles/github.css'
import styles from './MarkdownContent.module.css'

const languages = { c, cpp, java, python }

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function CodeBlock({ children }: ComponentProps<'pre'>) {
  const [copied, setCopied] = useState(false)
  const codeElement = Children.toArray(children).find(isValidElement) as
    | { props: { className?: string } }
    | undefined
  const language = /language-([\w+-]+)/.exec(codeElement?.props.className ?? '')?.[1] ?? 'code'

  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ''))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{language}</span>
        <button type="button" onClick={copy} aria-label="Sao chép code">
          {copied ? 'Đã chép' : 'Sao chép code'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

// Không bật HTML thô: nội dung Markdown do admin nhập nhưng vẫn được render an toàn theo mặc định.
function MarkdownContent({ children }: { children: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages, detect: false }]]}
        components={{ pre: CodeBlock }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
