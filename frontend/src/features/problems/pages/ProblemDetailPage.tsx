import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import ReportModal from '../components/ReportModal'
import ProblemStatement from '../components/ProblemStatement'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useProblemDetail } from '../useProblemDetail'
import styles from './ProblemDetailPage.module.css'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function ProblemDetailPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const [reportOpen, setReportOpen] = useState(false)
  const { state, retry } = useProblemDetail(code)

  if (state.phase !== 'ready') {
    return <ProblemStateMessage state={state} code={code} onRetry={retry} />
  }
  const { problem } = state

  const base = `/problems/${problem.code}`
  // Chưa đăng nhập: RequireAuth trên route /submit sẽ chuyển sang trang đăng nhập kèm returnTo.
  const submitPath = `${base}/submit`

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <div className={styles.left}>
          <ProblemStatement
            problem={problem}
          />

          <section className={styles.panel} aria-labelledby="comments-title">
            <div className={styles.commentsHeader}>
              <h2 id="comments-title">Bình luận</h2>
              <button className={styles.reportButton} type="button" onClick={() => setReportOpen(true)}>
                <Icon>
                  <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
                </Icon>
                Báo cáo vấn đề
              </button>
            </div>
            {/* Cơ sở dữ liệu chưa có bảng bình luận nên không hiển thị bình luận giả. */}
            <p>Tính năng bình luận chưa khả dụng.</p>
          </section>
        </div>

        <aside className={styles.right} aria-label="Thông tin bài tập">
          <section className={styles.panel} aria-labelledby="actions-title">
            <h2 id="actions-title" className={styles.sideTitle}>Thao tác</h2>
            <Link className={styles.submit} to={submitPath} data-authenticated={Boolean(user)}>
              
              Gửi bài giải
            </Link>
            <ul className={styles.actions}>
              <li>
                <a href={`${base}/pdf`} target="_blank" rel="noreferrer">
                  <Icon>
                    <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 14h6M10 17h4" />
                  </Icon>
                  Xem dạng PDF
                </a>
              </li>
              <li>
                <Link to={`${base}/submissions/me`}>
                  <Icon>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c.5-3.3 3.2-5.5 7-5.5s6.5 2.2 7 5.5" />
                  </Icon>
                  Bài nộp của tôi
                </Link>
              </li>
              <li>
                <Link to={`${base}/submissions`}>
                  <Icon>
                    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
                  </Icon>
                  Danh sách bài nộp
                </Link>
              </li>
              <li>
                <Link to={`${base}/submissions/best`}>
                  <Icon>
                    <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 3 3M16 6h4v2a3 3 0 0 1-3 3M12 13v4M8 20h8" />
                  </Icon>
                  Bài nộp tốt nhất
                </Link>
              </li>
              <li>
                <Link to={`${base}/solution`}>
                  <Icon>
                    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
                  </Icon>
                  Xem lời giải
                </Link>
              </li>
            </ul>
          </section>

          <section className={styles.panel} aria-labelledby="limits-title">
            <h2 id="limits-title" className={styles.sideTitle}>Thông tin chấm bài</h2>
            <dl className={styles.facts}>
              <div>
                <dt>
                  <Icon><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Icon>
                  Điểm
                </dt>
                <dd>{problem.scoringEnabled ? `${problem.points} điểm` : 'Không áp dụng'}</dd>
              </div>
              <div>
                <dt>
                  <Icon><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 3h6" /></Icon>
                  Giới hạn thời gian
                </dt>
                <dd>{problem.timeLimit}</dd>
              </div>
              <div>
                <dt>
                  <Icon><rect x="5" y="7" width="14" height="10" rx="2" /><path d="M9 7V4m6 3V4M9 20v-3m6 3v-3" /></Icon>
                  Giới hạn bộ nhớ
                </dt>
                <dd>{problem.memoryLimit}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="info-title">
            <h2 id="info-title" className={styles.sideTitle}>Thông tin bài tập</h2>
            <dl className={styles.info}>
              <div>
                <dt>Tác giả</dt>
                <dd>{problem.author ?? '—'}</dd>
              </div>
              <div>
                <dt>Chủ đề</dt>
                <dd>
                  <ul className={styles.tags}>
                    {problem.topics.length === 0 ? <li>—</li> : problem.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Ngôn ngữ cho phép</dt>
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
    </main>
  )
}

export default ProblemDetailPage
