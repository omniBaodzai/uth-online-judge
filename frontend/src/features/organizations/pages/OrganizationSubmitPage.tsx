import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileCode2 } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import CodeEditorPanel, { type AllowedLanguage } from '../../problems/submit/CodeEditorPanel'
import ProblemStatement from '../../problems/components/ProblemStatement'
import type { ProblemDetail } from '../../problems/detail-data'
import OrganizationTabState from '../components/OrganizationTabState'
import {
  getOrganizationContestProblem,
  getOrganizationContest,
  getOrganizationContestSubmissionLanguages,
  getOrganizationProblem,
  getOrganizationSubmissionLanguages,
  type OrganizationProblem,
} from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import styles from './OrganizationSubmitPage.module.css'

type SubmissionLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; problem: Omit<OrganizationProblem, 'editorials'>; languages: AllowedLanguage[]; submissionCode: string }

type State = { requestKey: string; value: SubmissionLoadState }

function toProblemDetail(problem: Omit<OrganizationProblem, 'editorials'>, languages: AllowedLanguage[]): ProblemDetail {
  return {
    code: problem.code,
    title: problem.title,
    status: 'unsolved',
    hasSolution: false,
    scoringEnabled: true,
    description: problem.statement,
    input: problem.inputDescription,
    constraints: problem.constraints,
    output: problem.outputDescription,
    illustrationUrl: null,
    illustrationWidth: 100,
    illustrationAspectRatio: 'auto',
    illustrationAlignment: 'center',
    examples: problem.examples.map(({ input, output }) => ({ input, output })),
    points: 0,
    timeLimitMs: problem.timeLimitSeconds * 1000,
    memoryLimitMb: problem.memoryLimitMb,
    author: null,
    topics: problem.tags,
    languages: languages.map(({ name }) => name),
    languageOptions: languages,
  }
}

export default function OrganizationSubmitPage() {
  const { t } = useTranslation('pages')
  const { organizationId: slug = '', problemId = '', contestId } = useParams()
  const { user } = useAuth()
  const api = useOrganizationsApi()
  const requestKey = `${slug}:${contestId ?? ''}:${problemId}`
  const [state, setState] = useState<State>({ requestKey: '', value: { status: 'loading' } })

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        if (contestId) {
          const [problem, languages, contest] = await Promise.all([
            getOrganizationContestProblem(api, slug, contestId, problemId, controller.signal),
            getOrganizationContestSubmissionLanguages(api, slug, contestId, problemId, controller.signal),
            getOrganizationContest(api, slug, contestId, controller.signal),
          ])
          const contestProblem = contest.problems.find((item) => item.problemId === problemId)
          if (!contestProblem) throw new Error(t('organizationContentProblemUnavailable'))
          if (!controller.signal.aborted) {
            setState({
              requestKey,
              value: { status: 'ready', problem, languages, submissionCode: contestProblem.problemCode },
            })
          }
        } else {
          const [problem, languages] = await Promise.all([
            getOrganizationProblem(api, slug, problemId, controller.signal),
            getOrganizationSubmissionLanguages(api, slug, problemId, controller.signal),
          ])
          if (!controller.signal.aborted) {
            setState({
              requestKey,
              value: { status: 'ready', problem, languages, submissionCode: problem.code },
            })
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            requestKey,
            value: { status: 'error', message: t('organizationContentProblemUnavailable') },
          })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [api, contestId, problemId, requestKey, slug, t])

  const currentState = state.requestKey === requestKey ? state.value : { status: 'loading' as const }

  if (currentState.status !== 'ready') {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          {currentState.status === 'loading'
            ? <OrganizationTabState kind="loading" icon={FileCode2} />
            : <OrganizationTabState kind="error" icon={FileCode2}>
                <p>{currentState.message}</p>
              </OrganizationTabState>}
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}`}>{t('organizationBackToList')}</Link>
        </div>
      </main>
    )
  }

  const problem = toProblemDetail(currentState.problem, currentState.languages)
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <nav className={styles.navigation} aria-label={t('organizationSubmissionNavigation')}>
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}`}>{t('organizationSubmitBack')}</Link>
          <Link className={styles.back} to={`/organizations/${encodeURIComponent(slug)}/submissions/mine`}>{t('organizationMySubmissions')}</Link>
        </nav>
        <div className={styles.grid}>
          <ProblemStatement problem={problem} />
          {user && (
            <CodeEditorPanel
              problemCode={currentState.submissionCode}
              userId={user.id}
              languages={currentState.languages}
              organizationSlug={slug}
              organizationContestId={contestId}
              contestProblemTitle={currentState.problem.title}
            />
          )}
        </div>
      </div>
    </main>
  )
}
