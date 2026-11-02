import { Link } from 'react-router-dom'
import type { StudentContestDetail, StudentContestTimeStatus } from '../../contests/student-contests.api'
import styles from './ContestProblemContext.module.css'

const timeStatusLabels: Record<StudentContestTimeStatus, string> = {
  UPCOMING: 'Sắp diễn ra',
  ONGOING: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
}

export function ContestProblemBanner({
  contest,
  maxScore,
}: {
  contest: Pick<StudentContestDetail, 'slug' | 'title' | 'timeStatus'>
  maxScore: number
}) {
  return (
    <section className={styles.banner} aria-label="Ngữ cảnh cuộc thi">
      <div className={styles.contestInfo}>
        <Link to={`/contests/${encodeURIComponent(contest.slug)}`}>← Quay lại cuộc thi</Link>
        <strong>{contest.title}</strong>
      </div>
      <div className={styles.details}>
        <span className={`${styles.status} ${contest.timeStatus === 'ONGOING' ? styles.ongoing : ''}`}>
          {timeStatusLabels[contest.timeStatus]}
        </span>
        <span>Điểm tối đa bài trong cuộc thi: <strong>{maxScore}</strong></span>
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
  const contestPath = `/contests/${encodeURIComponent(contestIdentifier)}`
  return (
    <main className={styles.main} id="main-content">
      <section
        className={styles.message}
        aria-busy={phase === 'loading'}
        aria-live={phase === 'loading' ? 'polite' : undefined}
      >
        {phase === 'loading' && <p role="status">Đang kiểm tra quyền truy cập và tải đề bài…</p>}
        {phase === 'not-found' && (
          <>
            <h1>Không tìm thấy bài trong cuộc thi</h1>
            <p>Bài tập không thuộc cuộc thi này, không còn khả dụng hoặc cuộc thi không tồn tại.</p>
            <Link className={styles.linkButton} to={contestPath}>Quay lại cuộc thi</Link>
          </>
        )}
        {phase === 'blocked' && (
          <>
            <h1>Chưa thể truy cập đề bài</h1>
            <p>{message}</p>
            <Link className={styles.linkButton} to={contestPath}>Quay lại cuộc thi</Link>
          </>
        )}
        {phase === 'error' && (
          <>
            <h1>Không thể tải bài thi</h1>
            <p role="alert">{message}</p>
            <button className={styles.linkButton} type="button" onClick={onRetry}>Thử lại</button>
            <Link className={styles.backLink} to={contestPath}>Quay lại cuộc thi</Link>
          </>
        )}
      </section>
    </main>
  )
}
