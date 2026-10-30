import { createPortal } from 'react-dom'
import Markdown from '../../../components/ui/Markdown'
import type { ProblemDetail } from '../detail-data'
import styles from './ProblemPrintView.module.css'

function ProblemPrintView({ problem }: { problem: ProblemDetail }) {
  return createPortal(
    <article className={`${styles.printDocument} print-document`}>
      <header className={styles.header}>
        <p className={styles.code}>{problem.code}</p>
        <h1>{problem.title}</h1>
        <dl className={styles.limits}>
          <div>
            <dt>Giới hạn thời gian</dt>
            <dd>{problem.timeLimit}</dd>
          </div>
          <div>
            <dt>Giới hạn bộ nhớ</dt>
            <dd>{problem.memoryLimit}</dd>
          </div>
        </dl>
      </header>

      {problem.description.trim() && (
        <section className={styles.section}>
          <h2>Đề bài</h2>
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
          <img src={problem.illustrationUrl} alt={`Hình minh họa cho bài ${problem.title}`} />
        </figure>
      )}

      {problem.input.trim().length > 0 && (
        <section className={styles.section}>
          <h2>Đầu vào</h2>
          <Markdown source={problem.input} math />
        </section>
      )}

      {problem.output.trim().length > 0 && (
        <section className={styles.section}>
          <h2>Đầu ra</h2>
          <Markdown source={problem.output} math />
        </section>
      )}

      {problem.constraints.trim().length > 0 && (
        <section className={styles.section}>
          <h2>Ràng buộc</h2>
          <Markdown source={problem.constraints} math />
        </section>
      )}

      {problem.examples.length > 0 && (
        <section className={styles.section}>
          <h2>Ví dụ</h2>
          {problem.examples.map((example, index) => (
            <section className={styles.example} key={`example-${index}`}>
              <h3>Ví dụ {index + 1}</h3>
              <div className={styles.exampleGrid}>
                <div className={styles.examplePart}>
                  <h4>Đầu vào</h4>
                  <pre>{example.input || ' '}</pre>
                </div>
                <div className={styles.examplePart}>
                  <h4>Đầu ra</h4>
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
