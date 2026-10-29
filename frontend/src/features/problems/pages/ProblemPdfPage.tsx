import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useProblemDetail } from '../useProblemDetail'
import styles from './ProblemPdfPage.module.css'

const PRINT_BODY_CLASS = 'problem-pdf-print'
const AUTO_PRINT_DELAY_MS = 300

function ProblemPdfPage() {
  const { code = '' } = useParams()
  const { state, retry } = useProblemDetail(code)
  const ready = state.phase === 'ready'

  // Đánh dấu body để CSS in ẩn Header/Navbar/Footer của AppLayout mà không sửa các component đó.
  useEffect(() => {
    document.body.classList.add(PRINT_BODY_CLASS)
    return () => document.body.classList.remove(PRINT_BODY_CLASS)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timeoutId = window.setTimeout(() => window.print(), AUTO_PRINT_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [ready, code])

  if (state.phase !== 'ready') {
    return <ProblemStateMessage state={state} code={code} onRetry={retry} />
  }

  const { problem } = state

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.toolbar}>
        <Link className={styles.button} to={`/problems/${problem.code}`}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
          Quay lại trang bài tập
        </Link>
        <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => window.print()}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
          </svg>
          In / Lưu PDF
        </button>
      </div>

      <article className={styles.paper} id="problem-pdf-document">
        <header className={styles.header}>
          <h1>
            {problem.code} — {problem.title}
          </h1>
          <p className={styles.limits}>
            Giới hạn thời gian: {problem.timeLimit} · Giới hạn bộ nhớ: {problem.memoryLimit}
          </p>
        </header>

        <section>
          <h2>Đề bài</h2>
          {problem.description.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>

        {problem.input.length > 0 && (
          <section>
            <h2>Đầu vào (Input)</h2>
            {problem.input.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        )}

        {problem.constraints.length > 0 && (
          <section>
            <h2>Giới hạn (Constraints)</h2>
            <ul>
              {problem.constraints.map((text, i) => (
                <li key={i}>
                  <code>{text}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {problem.output.length > 0 && (
          <section>
            <h2>Đầu ra (Output)</h2>
            {problem.output.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        )}

        {problem.examples.length > 0 && (
          <section>
            <h2>Ví dụ</h2>
            {problem.examples.map((example, i) => (
              <div className={styles.example} key={i}>
                <h3>Ví dụ {i + 1}</h3>
                <div className={styles.exampleGrid}>
                  <div>
                    <strong>Input</strong>
                    <pre>{example.input}</pre>
                  </div>
                  <div>
                    <strong>Output</strong>
                    <pre>{example.output}</pre>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </article>
    </main>
  )
}

export default ProblemPdfPage
