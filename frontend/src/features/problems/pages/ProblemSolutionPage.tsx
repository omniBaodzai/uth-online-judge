import { Link, useParams } from 'react-router-dom'
import MarkdownContent from '../components/MarkdownContent'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useProblemSolution } from '../useProblemSolution'
import styles from './ProblemSolutionPage.module.css'

function ProblemSolutionPage() {
  const { code = '' } = useParams()
  const { state, retry } = useProblemSolution(code)

  if (state.phase !== 'ready') {
    return <ProblemStateMessage state={state} code={code} onRetry={retry} />
  }

  const { data } = state
  const backPath = `/problems/${data.code}`

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <Link className={styles.button} to={backPath}>
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
            Quay lại trang bài tập
          </Link>
          <p className={styles.problemTitle}>
            {data.code} — {data.title}
          </p>
        </div>

        <section className={styles.card} aria-labelledby="solution-title">
          <h1 id="solution-title">Lời giải bài tập</h1>
          {data.solution ? (
            <MarkdownContent>{data.solution}</MarkdownContent>
          ) : (
            <div className={styles.empty}>
              <p>Nội dung đang được xây dựng. Vui lòng quay lại sau.</p>
              <Link className={`${styles.button} ${styles.primary}`} to={backPath}>
                Quay lại bài tập
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default ProblemSolutionPage
