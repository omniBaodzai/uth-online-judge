import { useState, type MouseEvent } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import LoginRequiredNotice from '../../auth/components/LoginRequiredNotice'
import ProblemSample from '../components/ProblemSample'
import ProblemComments from '../components/ProblemComments'
import { getOrganization } from '../../organizations/data'
import { problems } from '../data'
import { problemDetails } from '../data/problemDetails'
import { submissionLanguages } from '../data/submissionLanguages'
import styles from './ProblemDetailPage.module.css'

type ProblemDetailPageProps = {
  problemId: string
}

function ProblemDetailPage({ problemId }: ProblemDetailPageProps) {
  const problem = problems.find((item) => item.id === problemId)
  const detail = problemDetails[problemId]
  const organization = getOrganization(new URLSearchParams(window.location.search).get('org') ?? '')
  const { isAuthenticated, isLoading } = useAuth()
  const [showLoginNotice, setShowLoginNotice] = useState(false)

  function handleSubmitClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isAuthenticated) return
    event.preventDefault()
    if (!isLoading) setShowLoginNotice(true)
  }

  if (!problem || !detail) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.notFound}>
          <p className={styles.eyebrow}>UTH ONLINE JUDGE</p>
          <h1>Không tìm thấy bài tập</h1>
          <p>Mã bài <strong>{problemId}</strong> không tồn tại hoặc chưa có nội dung.</p>
          <a href="/problems">Quay lại danh sách bài tập</a>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Điều hướng đường dẫn">
          {organization ? (
            <>
              <a href="/organizations">Tổ chức</a>
              <span aria-hidden="true">/</span>
              <a href={`/organizations/${organization.id}`}>{organization.name}</a>
              <span aria-hidden="true">/</span>
              <a href={`/organizations/${organization.id}/problems`}>Danh sách bài</a>
            </>
          ) : (
            <a href="/problems">Danh sách bài tập</a>
          )}
          <span aria-hidden="true">/</span>
          <span>{problem.id}</span>
        </nav>

        <div className={styles.layout}>
          <article className={styles.statement}>
            <header className={styles.problemHeader}>
              <div className={styles.problemTitleRow}>
                <span className={styles.problemId}>{problem.id}</span>
                <span className={`${styles.difficulty} ${styles[problem.difficulty === 'Dễ' ? 'easy' : problem.difficulty === 'Khó' ? 'hard' : 'medium']}`}>
                  {problem.difficulty}
                </span>
              </div>
              <h1>{problem.title}</h1>
              <div className={styles.tags}>
                {problem.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </header>

            <section className={styles.statementSection}>
              <h2>Mô tả</h2>
              {detail.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>

            <section className={styles.statementSection}>
              <h2>Đầu vào</h2>
              <p>{detail.input}</p>
            </section>

            <section className={styles.statementSection}>
              <h2>Giới hạn</h2>
              <ul className={styles.constraints}>
                {detail.constraints.map((constraint) => <li key={constraint}><code>{constraint}</code></li>)}
              </ul>
            </section>

            <section className={styles.statementSection}>
              <h2>Đầu ra</h2>
              <p>{detail.output}</p>
            </section>

            <section className={styles.statementSection}>
              <h2>Ví dụ</h2>
              {detail.examples.map((example, index) => (
                <ProblemSample example={example} index={index} key={`${problem.id}-sample-${index}`} />
              ))}
            </section>
          </article>

          <aside className={styles.sidebar} aria-label="Thông tin và thao tác bài tập">
            <section className={styles.actionsPanel}>
              <a className={styles.submitButton} href={`/problems/${problem.id}/submit`} onClick={handleSubmitClick}>
                <span aria-hidden="true">↑</span> Gửi bài giải
              </a>
              {showLoginNotice && !isAuthenticated && (
                <LoginRequiredNotice message="Bạn cần đăng nhập để gửi bài giải." />
              )}
              <a className={styles.quickLink} href={`/submissions?problemId=${problem.id}`}>
                <span aria-hidden="true">☷</span> Danh sách bài nộp <span aria-hidden="true">→</span>
              </a>
              <a className={styles.quickLink} href={`/submissions?problemId=${problem.id}&sort=best`}>
                <span aria-hidden="true">◆</span> Bài nộp tốt nhất <span aria-hidden="true">→</span>
              </a>
            </section>

            <section className={styles.infoPanel}>
              <h2>Thông tin bài tập</h2>
              <InfoRow label="Điểm tối đa" value={`${problem.score.toFixed(2)} điểm`} />
              <InfoRow label="Giới hạn thời gian" value={detail.timeLimit} />
              <InfoRow label="Giới hạn bộ nhớ" value={detail.memoryLimit} />
              <InfoRow label="Input / Output" value="stdin / stdout" />
              <InfoRow label="Nguồn bài" value={detail.source} />
              <InfoRow label="Dạng bài" value={problem.topic} />
              <div className={styles.languageList}>
                <h3>Ngôn ngữ hỗ trợ</h3>
                <div>{submissionLanguages.map((item) => <span key={item}>{item}</span>)}</div>
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div><span>Tỷ lệ giải đúng</span><strong>{problem.acceptance.toFixed(1)}%</strong></div>
              <div><span>Lượt giải thành công</span><strong>{problem.acceptedCount.toLocaleString('vi-VN')}</strong></div>
            </section>
          </aside>
        </div>
        <ProblemComments />
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><span>{label}</span><strong>{value}</strong></div>
}

export default ProblemDetailPage