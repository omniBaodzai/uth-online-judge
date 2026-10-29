import { useState } from 'react'
import type { ProblemDetail, ProblemExample } from '../detail-data'
import { statusLabels, type ProblemStatus } from '../data'
import styles from '../pages/ProblemDetailPage.module.css'

export function StatusBadge({ status }: { status: ProblemStatus }) {
  return (
    <span className={`${styles.status} ${styles[status]}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {status === 'solved' && <path d="m6 12.5 4 4 8-9" />}
        {status === 'wrong' && <path d="m7 7 10 10M17 7 7 17" />}
        {status === 'unsolved' && <circle cx="12" cy="12" r="1.2" />}
      </svg>
      {statusLabels[status]}
    </span>
  )
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label={`Sao chép ${label}`}>
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <pre>{value}</pre>
    </div>
  )
}

function Example({ index, example }: { index: number; example: ProblemExample }) {
  return (
    <div className={styles.example}>
      <h3>Ví dụ {index}</h3>
      <div className={styles.exampleGrid}>
        <CodeBlock label="Input" value={example.input} />
        <CodeBlock label="Output" value={example.output} />
      </div>
    </div>
  )
}

type ProblemStatementProps = {
  problem: ProblemDetail
  className?: string
}

// Nội dung đề bài dùng chung cho trang chi tiết và trang gửi bài giải.
function ProblemStatement({ problem, className = '' }: ProblemStatementProps) {
  return (
    <article className={`${styles.panel} ${styles.statement} ${className}`}>
      <header className={styles.header}>
        <h1>
          {problem.title}
        </h1>
        <StatusBadge status={problem.status} />
      </header>

      <section>
        <h2>Đề bài</h2>
        {problem.description.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </section>
      {problem.input.length > 0 && (
        <section>
          <h2>Đầu vào</h2>
          {problem.input.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>
      )}
      {problem.constraints.length > 0 && (
        <section>
          <h2>Giới hạn</h2>
          <ul className={styles.constraints}>
            {problem.constraints.map((text, i) => (
              <li key={i}><code>{text}</code></li>
            ))}
          </ul>
        </section>
      )}
      {problem.output.length > 0 && (
        <section>
          <h2>Đầu ra</h2>
          {problem.output.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>
      )}
      {problem.examples.length > 0 && (
        <section>
          <h2>Ví dụ</h2>
          {problem.examples.map((example, index) => (
            <Example key={index} index={index + 1} example={example} />
          ))}
        </section>
      )}
    </article>
  )
}

export default ProblemStatement
