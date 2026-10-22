import { useState } from 'react'
import type { ProblemExample } from '../data/problemDetails'
import styles from './ProblemSample.module.css'

type ProblemSampleProps = {
  example: ProblemExample
  index: number
}

function ProblemSample({ example, index }: ProblemSampleProps) {
  const [copied, setCopied] = useState<'input' | 'output' | null>(null)

  async function copyText(value: string, kind: 'input' | 'output') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className={styles.example}>
      <h3>Ví dụ {String(index + 1).padStart(2, '0')}</h3>
      <div className={styles.sampleGrid}>
        <SamplePanel title={`Input ${String(index + 1).padStart(2, '0')}`} value={example.input} copied={copied === 'input'} onCopy={() => copyText(example.input, 'input')} />
        <SamplePanel title={`Output ${String(index + 1).padStart(2, '0')}`} value={example.output} copied={copied === 'output'} onCopy={() => copyText(example.output, 'output')} />
      </div>
    </div>
  )
}

function SamplePanel({ title, value, copied, onCopy }: { title: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <section className={styles.samplePanel} aria-label={title}>
      <div className={styles.sampleHeader}>
        <h4>{title}</h4>
        <button type="button" onClick={onCopy} aria-label={`Copy ${title}`}>
          <span aria-hidden="true">▢</span> {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <pre><code>{value}</code></pre>
    </section>
  )
}

export default ProblemSample