import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Markdown from '../../../components/ui/Markdown'
import { formatTimeLimit, type ProblemDetail } from '../detail-data'
import '../i18n'
import styles from './ProblemPrintView.module.css'

function ProblemPrintView({ problem }: { problem: ProblemDetail }) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  return createPortal(
    <article className={`${styles.printDocument} print-document`}>
      <header className={styles.header}>
        <p className={styles.code}>{problem.code}</p>
        <h1>{problem.title}</h1>
        <dl className={styles.limits}>
          <div>
            <dt>{t('problemTimeLimit')}</dt>
            <dd>{formatTimeLimit(problem.timeLimitMs, locale, t('problemSeconds'))}</dd>
          </div>
          <div>
            <dt>{t('problemMemoryLimit')}</dt>
            <dd>{numberFormat.format(problem.memoryLimitMb)} MB</dd>
          </div>
        </dl>
      </header>

      {problem.description.trim() && (
        <section className={styles.section}>
          <h2>{t('problemStatement')}</h2>
          <Markdown source={problem.description} math />
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
          <img src={problem.illustrationUrl} alt={t('problemIllustrationAlt', { title: problem.title })} />
        </figure>
      )}

      {problem.input.trim().length > 0 && (
        <section className={styles.section}>
          <h2>{t('problemInput')}</h2>
          <Markdown source={problem.input} math />
        </section>
      )}

      {problem.output.trim().length > 0 && (
        <section className={styles.section}>
          <h2>{t('problemOutput')}</h2>
          <Markdown source={problem.output} math />
        </section>
      )}

      {problem.constraints.trim().length > 0 && (
        <section className={styles.section}>
          <h2>{t('problemConstraints')}</h2>
          <Markdown source={problem.constraints} math />
        </section>
      )}

      {problem.examples.length > 0 && (
        <section className={styles.section}>
          <h2>{t('problemExamples')}</h2>
          {problem.examples.map((example, index) => (
            <section className={styles.example} key={`example-${index}`}>
              <h3>{t('problemExampleNumber', { number: new Intl.NumberFormat(locale).format(index + 1) })}</h3>
              <div className={styles.exampleGrid}>
                <div className={styles.examplePart}>
                  <h4>{t('problemInput')}</h4>
                  <pre>{example.input || ' '}</pre>
                </div>
                <div className={styles.examplePart}>
                  <h4>{t('problemOutput')}</h4>
                  <pre>{example.output || ' '}</pre>
                </div>
              </div>
            </section>
          ))}
        </section>
      )}
    </article>,
    document.body,
  )
}

export default ProblemPrintView
