import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProblemDetail, ProblemExample } from '../detail-data'
import Markdown from '../../../components/ui/Markdown'
import type { ProblemStatus } from '../data'
import '../i18n'
import styles from '../pages/ProblemDetailPage.module.css'

export function StatusBadge({ status }: { status: ProblemStatus }) {
  const { t } = useTranslation('pages')
  return (
    <span className={`${styles.status} ${styles[status]}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {status === 'solved' && <path d="m6 12.5 4 4 8-9" />}
        {status === 'wrong' && <path d="m7 7 10 10M17 7 7 17" />}
        {status === 'unsolved' && <circle cx="12" cy="12" r="1.2" />}
      </svg>
      {t(status === 'solved' ? 'problemStatusSolved' : status === 'wrong' ? 'problemStatusWrong' : 'problemStatusUnsolved')}
    </span>
  )
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('pages')
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
        <button type="button" onClick={copy} aria-label={`${t('problemCopy')} ${label}`}>
          {copied ? t('problemCopied') : t('problemCopy')}
        </button>
      </div>
      <pre>{value}</pre>
    </div>
  )
}

function Example({ index, example }: { index: number; example: ProblemExample }) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  return (
    <div className={styles.example}>
      <h3>{t('problemExampleNumber', { number: new Intl.NumberFormat(locale).format(index) })}</h3>
      <div className={styles.exampleGrid}>
        <CodeBlock label={t('problemInput')} value={example.input} />
        <CodeBlock label={t('problemOutput')} value={example.output} />
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
  const { t } = useTranslation('pages')
  return (
    <article className={`${styles.panel} ${styles.statement} ${className}`}>
      <header className={styles.header}>
        <h1>
          {problem.title}
        </h1>
        <StatusBadge status={problem.status} />
      </header>

      {problem.description.trim() && (
        <section>
          <h2>{t('problemStatement')}</h2>
          <Markdown className={styles.prose} source={problem.description} math />
        </section>
      )}
      {problem.illustrationUrl && (
        <figure
          className={`${styles.illustration} ${styles[`illustration_${problem.illustrationAlignment}`]}`}
          style={{
            width: `${problem.illustrationWidth}%`,
            ...(problem.illustrationAspectRatio === 'auto'
              ? {}
              : { aspectRatio: problem.illustrationAspectRatio.replace(':', ' / ') }),
          }}
        >
          <img src={problem.illustrationUrl} alt={t('problemIllustrationAlt', { title: problem.title })} loading="lazy" />
        </figure>
      )}
      {problem.input.trim().length > 0 && (
        <section>
          <h2>{t('problemInput')}</h2>
          <Markdown className={styles.prose} source={problem.input} math />
        </section>
      )}
      {problem.constraints.trim().length > 0 && (
        <section>
          <h2>{t('problemConstraints')}</h2>
          <Markdown source={problem.constraints} math />
        </section>
      )}
      {problem.output.trim().length > 0 && (
        <section>
          <h2>{t('problemOutput')}</h2>
          <Markdown className={styles.prose} source={problem.output} math />
        </section>
      )}
      {problem.examples.length > 0 && (
        <section>
          <h2>{t('problemExamples')}</h2>
          {problem.examples.map((example, index) => (
            <Example key={index} index={index + 1} example={example} />
          ))}
        </section>
      )}
    </article>
  )
}

export default ProblemStatement
