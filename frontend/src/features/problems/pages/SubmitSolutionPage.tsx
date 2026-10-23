import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import ProblemStatement from '../components/ProblemStatement'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useProblemDetail } from '../useProblemDetail'
import CodeEditorPanel from '../submit/CodeEditorPanel'
import detail from './ProblemDetailPage.module.css'
import styles from './SubmitSolutionPage.module.css'

type Tab = 'statement' | 'editor'

function SubmitSolutionPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('editor')
  const { state, retry } = useProblemDetail(code)

  if (state.phase !== 'ready') {
    return <ProblemStateMessage state={state} code={code} onRetry={retry} />
  }
  const { problem } = state

  return (
    <main className={detail.main} id="main-content">
      <div className={styles.wrap}>
        <div className={styles.tabs} role="tablist" aria-label="Chế độ xem">
          <button
            type="button"
            role="tab"
            id="tab-statement"
            aria-selected={tab === 'statement'}
            aria-controls="pane-statement"
            onClick={() => setTab('statement')}
          >
            Đề bài
          </button>
          <button
            type="button"
            role="tab"
            id="tab-editor"
            aria-selected={tab === 'editor'}
            aria-controls="pane-editor"
            onClick={() => setTab('editor')}
          >
            Soạn code
          </button>
        </div>
        <div className={styles.grid}>
          <div
            id="pane-statement"
            role="tabpanel"
            aria-labelledby="tab-statement"
            className={`${styles.statementPane} ${tab === 'statement' ? '' : styles.inactive}`}
          >
            <ProblemStatement
              problem={problem}
            />
          </div>
          <div
            id="pane-editor"
            role="tabpanel"
            aria-labelledby="tab-editor"
            className={`${styles.editorPane} ${tab === 'editor' ? '' : styles.inactive}`}
          >
            {user && <CodeEditorPanel problemCode={problem.code} userId={user.id} languages={problem.languageOptions} />}
          </div>
        </div>
      </div>
    </main>
  )
}

export default SubmitSolutionPage
