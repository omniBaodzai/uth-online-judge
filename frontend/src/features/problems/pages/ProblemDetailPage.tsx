import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import '../i18n'
import { useBreadcrumbContestProblem } from '../../../components/navigation/useBreadcrumbContestProblem'
import ReportModal from '../components/ReportModal'
import ProblemStatement from '../components/ProblemStatement'
import ProblemPrintView from '../components/ProblemPrintView'
import ProblemStateMessage from '../components/ProblemStateMessage'
import {
  ContestProblemBanner,
  ContestProblemStateMessage,
} from '../components/ContestProblemContext'
import { useContestProblemDetail } from '../useContestProblemDetail'
import { useProblemDetail } from '../useProblemDetail'
import { formatTimeLimit } from '../detail-data'
import styles from './ProblemDetailPage.module.css'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function ProblemDetailPage() {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const { code = '', contestId } = useParams()
  const { user } = useAuth()
  const [reportOpen, setReportOpen] = useState(false)
  const practiceDetail = useProblemDetail(code, !contestId)
  const contestDetail = useContestProblemDetail(contestId, code)
  const contestState = contestDetail.state
  const contest = contestState.phase !== 'loading' && 'contest' in contestState
    ? contestState.contest
    : undefined
  const contestProblemTitle = contestState.phase === 'ready'
    ? contestState.problem.title
    : undefined
  useBreadcrumbContestProblem(contestId, contest, contestProblemTitle)

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

  const base = `/problems/${problem.code}`
  // Chưa đăng nhập: RequireAuth trên route /submit sẽ chuyển sang trang đăng nhập kèm returnTo.
  const submitPath = contestState.phase === 'ready'
    ? `/contests/${encodeURIComponent(contestState.contest.slug)}/problems/${encodeURIComponent(problem.code)}/submit`
    : `${base}/submit`

  return (
    <main className={styles.main} id="main-content">
      {contestState.phase === 'ready' && (
        <ContestProblemBanner
          contest={contestState.contest}
          maxScore={contestState.contestProblem.maxScore}
        />
      )}
      <div className={styles.grid}>
        <div className={styles.left}>
          <ProblemStatement
            problem={problem}
          />

          <section className={styles.panel} aria-labelledby="comments-title">
            <div className={styles.commentsHeader}>
              <h2 id="comments-title">{t('problemCommentsTitle')}</h2>
              <button className={styles.reportButton} type="button" onClick={() => setReportOpen(true)}>
                <Icon>
                  <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
                </Icon>
                {t('problemReportIssue')}
              </button>
            </div>
            {/* Cơ sở dữ liệu chưa có bảng bình luận nên không hiển thị bình luận giả. */}
            <p>{t('problemCommentsUnavailable')}</p>
          </section>
        </div>

        <aside className={styles.right} aria-label={t('problemInfoLabel')}>
          <section className={styles.panel} aria-labelledby="actions-title">
            <Link className={styles.submit} to={submitPath} data-authenticated={Boolean(user)}>
              {contestState.phase === 'ready' ? t('problemSubmitContest') : t('problemSubmitSolution')}
            </Link>
            {!contestId && <ul className={styles.actions}>
              <li>
                <button type="button" onClick={() => window.print()}>
                  <Icon>
                    <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 14h6M10 17h4" />
                  </Icon>
                  {t('problemPrintPdf')}
                </button>
              </li>
              <li>
                <Link to={`${base}/submissions/me`}>
                  <Icon>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.5-3.3 3.2-5.5 7-5.5s6.5 2.2 7 5.5" />
                  </Icon>
                  {t('problemMySubmissions')}
                </Link>
              </li>
              <li>
                <Link to={`${base}/submissions`}>
                  <Icon>
                    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                  </Icon>
                  {t('problemSubmissionList')}
                </Link>
              </li>
              <li>
                <Link to={`${base}/best-submissions`}>
                  <Icon>
                    <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 3 3M16 6h4v2a3 3 0 0 1-3 3M12 13v4M8 20h8" />
                  </Icon>
                  {t('problemBestSubmissions')}
                </Link>
              </li>
              <li>
                <Link to={`${base}/solution`}>
                  <Icon>
                    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
                  </Icon>
                  {t('problemViewSolution')}
                </Link>
              </li>
            </ul>}
          </section>

          <section className={styles.panel} aria-labelledby="limits-title">
            <h2 id="limits-title" className={styles.sideTitle}>{t('problemJudgeInfo')}</h2>
            <dl className={styles.facts}>
              <div>
                <dt>
                  <Icon><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Icon>
                  {contestId ? t('problemPointsContest') : t('problemPoints')}
                </dt>
                <dd>{contestState.phase === 'ready'
                  ? t('problemPointUnit', { value: numberFormat.format(contestState.contestProblem.maxScore) })
                  : problem.scoringEnabled
                    ? t('problemPointUnit', { value: numberFormat.format(problem.points) })
                    : t('problemNoScore')}</dd>
              </div>
              <div>
                <dt>
                  <Icon><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 3h6" /></Icon>
                  {t('problemTimeLimit')}
                </dt>
                <dd>{formatTimeLimit(problem.timeLimitMs, locale, t('problemSeconds'))}</dd>
              </div>
              <div>
                <dt>
                  <Icon><rect x="5" y="7" width="14" height="10" rx="2" /><path d="M9 7V4m6 3V4M9 20v-3m6 3v-3" /></Icon>
                  {t('problemMemoryLimit')}
                </dt>
                <dd>{numberFormat.format(problem.memoryLimitMb)} MB</dd>
              </div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="info-title">
            <h2 id="info-title" className={styles.sideTitle}>{t('problemInfoLabel')}</h2>
            <dl className={styles.info}>
              <div>
                <dt>{t('problemAuthor')}</dt>
                <dd>{problem.author ?? '—'}</dd>
              </div>
              <div>
                <dt>{t('problemTopic')}</dt>
                <dd>
                  <ul className={styles.tags}>
                    {problem.topics.length === 0 ? <li>—</li> : problem.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>{t('problemAllowedLanguages')}</dt>
                <dd>
                  <ul className={`${styles.tags} ${styles.langs}`}>
                    {problem.languages.map((language) => (
                      <li key={language}>{language}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
      <ProblemPrintView problem={problem} />
    </main>
  )
}

export default ProblemDetailPage
