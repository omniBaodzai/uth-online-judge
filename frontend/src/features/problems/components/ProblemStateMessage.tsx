import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ProblemDetailState } from '../useProblemDetail'
import '../i18n'
import styles from '../pages/ProblemDetailPage.module.css'

type ProblemStateMessageProps = {
  state: Exclude<ProblemDetailState, { phase: 'ready' }>
  code: string
  onRetry: () => void
}

// Hiển thị trạng thái tải, lỗi mạng và không tìm thấy dùng chung cho trang chi tiết và trang gửi bài.
function ProblemStateMessage({ state, code, onRetry }: ProblemStateMessageProps) {
  const { t } = useTranslation('pages')
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.notFound} aria-busy={state.phase === 'loading'}>
        {state.phase === 'loading' && <p role="status">{t('problemLoadingDetail')}</p>}
        {state.phase === 'not-found' && (
          <>
            <h1>{t('problemNotFound')}</h1>
            <p>{t('problemNotFoundDescription', { code })}</p>
            <Link className={styles.cta} to="/problems">{t('problemBackToList')}</Link>
          </>
        )}
        {state.phase === 'error' && (
          <div role="alert">
            <h1>{t('problemCannotLoad')}</h1>
            <p>{state.message}</p>
            <button className={styles.cta} type="button" onClick={onRetry}>{t('retry', { ns: 'common' })}</button>
          </div>
        )}
      </div>
    </main>
  )
}

export default ProblemStateMessage
