import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { useBreadcrumbContestProblem } from '../../../components/navigation/useBreadcrumbContestProblem'
import {
  ContestProblemBanner,
  ContestProblemStateMessage,
} from '../components/ContestProblemContext'
import ProblemStatement from '../components/ProblemStatement'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useContestProblemDetail } from '../useContestProblemDetail'
import { useProblemDetail } from '../useProblemDetail'
import '../i18n'
import CodeEditorPanel from '../submit/CodeEditorPanel'
import detail from './ProblemDetailPage.module.css'
import styles from './SubmitSolutionPage.module.css'

type Tab = 'statement' | 'editor'

function SubmitSolutionPage() {
  const { t } = useTranslation('pages')
  const { code = '', contestId } = useParams()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('editor')
  const practiceDetail = useProblemDetail(code, !contestId)
  const contestDetail = useContestProblemDetail(contestId, code)
  const contestState = contestDetail.state
  const contest = contestState.phase !== 'loading' && 'contest' in contestState
    ? contestState.contest
    : undefined
  const problemTitle = contestState.phase === 'ready'
    ? contestState.problem.title
    : undefined
  useBreadcrumbContestProblem(contestId, contest, problemTitle)

  if (contestId && contestState.phase !== 'ready') {
    return (
      <ContestProblemStateMessage
        contestIdentifier={contest?.slug ?? contestId}
        phase={contestState.phase}
        message={'message' in contestState ? contestState.message : undefined}
        onRetry={contestDetail.retry}
      />
    )
  }
  if (!contestId && practiceDetail.state.phase !== 'ready') {
    return <ProblemStateMessage state={practiceDetail.state} code={code} onRetry={practiceDetail.retry} />
  }
  const problem = contestId && contestState.phase === 'ready'
    ? contestState.problem
    : !contestId && practiceDetail.state.phase === 'ready'
      ? practiceDetail.state.problem
      : null
  if (!problem) return null

  return (
    <main className={detail.main} id="main-content">
      {contestState.phase === 'ready' && (
        <ContestProblemBanner
          contest={contestState.contest}
          maxScore={contestState.contestProblem.maxScore}
        />
      )}
      <div className={styles.wrap}>
        <div className={styles.tabs} role="tablist" aria-label={t('problemEditorTablist')}>
          <button
            type="button"
            role="tab"
            id="tab-statement"
            aria-selected={tab === 'statement'}
            aria-controls="pane-statement"
            onClick={() => setTab('statement')}
          >
            {t('problemStatementTab')}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-editor"
            aria-selected={tab === 'editor'}
            aria-controls="pane-editor"
            onClick={() => setTab('editor')}
          >
            {t('problemEditorTab')}
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
            {user && (
              <CodeEditorPanel
                problemCode={problem.code}
                userId={user.id}
                languages={problem.languageOptions}
                contestIdentifier={contestState.phase === 'ready' ? contestState.contest.slug : undefined}
                contestTitle={contestState.phase === 'ready' ? contestState.contest.title : undefined}
                contestProblemTitle={contestState.phase === 'ready' ? problem.title : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default SubmitSolutionPage
