import { Link } from 'react-router-dom'
import type { ProblemDetailState } from '../useProblemDetail'
import styles from '../pages/ProblemDetailPage.module.css'

type ProblemStateMessageProps = {
  state: Exclude<ProblemDetailState, { phase: 'ready' }>
  code: string
  onRetry: () => void
}

// Hiển thị trạng thái tải, lỗi mạng và không tìm thấy dùng chung cho trang chi tiết và trang gửi bài.
function ProblemStateMessage({ state, code, onRetry }: ProblemStateMessageProps) {
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.notFound} aria-busy={state.phase === 'loading'}>
        {state.phase === 'loading' && <p role="status">Đang tải bài tập…</p>}
        {state.phase === 'not-found' && (
          <>
            <h1>Không tìm thấy bài tập</h1>
            <p>Bài tập “{code}” không tồn tại hoặc chưa được xuất bản.</p>
            <Link className={styles.cta} to="/problems">Quay lại danh sách bài tập</Link>
          </>
        )}
        {state.phase === 'error' && (
          <div role="alert">
            <h1>Không thể tải bài tập</h1>
            <p>{state.message}</p>
            <button className={styles.cta} type="button" onClick={onRetry}>Thử lại</button>
          </div>
        )}
      </div>
    </main>
  )
}

export default ProblemStateMessage
