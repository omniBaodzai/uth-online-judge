import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { StudentContestDetail } from '../../contests/student-contests.api'
import '../i18n'
import styles from './ContestProblemContext.module.css'

export function ContestProblemBanner({
  contest,
  maxScore,
}: {
  contest: Pick<StudentContestDetail, 'slug' | 'title' | 'timeStatus'>
  maxScore: number
}) {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  return (
    <section className={styles.banner} aria-label={t('problemContestContext')}>
      <div className={styles.contestInfo}>
        <Link to={`/contests/${encodeURIComponent(contest.slug)}`}>← {t('problemBackToContest')}</Link>
        <strong>{contest.title}</strong>
      </div>
      <div className={styles.details}>
        <span className={`${styles.status} ${contest.timeStatus === 'ONGOING' ? styles.ongoing : ''}`}>
          {t(contest.timeStatus === 'UPCOMING' ? 'problemContestUpcoming' : contest.timeStatus === 'ONGOING' ? 'problemContestOngoing' : 'problemContestEnded')}
        </span>
        <span>{t('problemContestMaxPoints')} <strong>{new Intl.NumberFormat(locale).format(maxScore)}</strong></span>
      </div>
    </section>
  )
}

export function ContestProblemStateMessage({
  contestIdentifier,
  phase,
  message,
  onRetry,
}: {
  contestIdentifier: string
  phase: 'loading' | 'not-found' | 'blocked' | 'error'
  message?: string
  onRetry: () => void
}) {
  const { t } = useTranslation('pages')
  const contestPath = `/contests/${encodeURIComponent(contestIdentifier)}`
  return (
    <main className={styles.main} id="main-content">
      <section
        className={styles.message}
        aria-busy={phase === 'loading'}
        aria-live={phase === 'loading' ? 'polite' : undefined}
      >
        {phase === 'loading' && <p role="status">{t('problemLoadingContest')}</p>}
        {phase === 'not-found' && (
          <>
            <h1>{t('problemContestNotFound')}</h1>
            <p>{t('problemContestNotFoundDescription')}</p>
            <Link className={styles.linkButton} to={contestPath}>{t('problemBackToContest')}</Link>
          </>
        )}
        {phase === 'blocked' && (
          <>
            <h1>{t('problemCannotAccessContestProblem')}</h1>
            <p>{message}</p>
            <Link className={styles.linkButton} to={contestPath}>{t('problemBackToContest')}</Link>
          </>
        )}
        {phase === 'error' && (
          <>
            <h1>{t('problemCannotLoadContest')}</h1>
            <p role="alert">{message}</p>
            <button className={styles.linkButton} type="button" onClick={onRetry}>{t('retry', { ns: 'common' })}</button>
            <Link className={styles.backLink} to={contestPath}>{t('problemBackToContest')}</Link>
          </>
        )}
      </section>
    </main>
  )
}
