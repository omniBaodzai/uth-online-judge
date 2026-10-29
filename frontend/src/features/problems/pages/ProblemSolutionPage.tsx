import { lazy, Suspense, useEffect, useState } from 'react'
import { BookOpen, Check, Copy, LockKeyhole } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { fetchProblemEditorial, type ProblemEditorialResponse } from '../api'
import styles from './ProblemSolutionPage.module.css'

const SolutionCodeViewer = lazy(() => import('../components/SolutionCodeViewer'))

type PageState =
  | { phase: 'loading'; code: string }
  | { phase: 'ready'; code: string; result: ProblemEditorialResponse }
  | { phase: 'locked'; code: string }
  | { phase: 'error'; code: string; message: string }

function ProblemSolutionPage() {
  const { code = '' } = useParams()
  const { request } = useAuth()
  const [state, setState] = useState<PageState>({ phase: 'loading', code: '' })
  const [selectedId, setSelectedId] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    fetchProblemEditorial(request, code)
      .then((result) => {
        if (active) {
          setState({ phase: 'ready', code, result })
          setSelectedId(result.editorials[0]?.id ?? '')
          setCopyMessage('')
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 403) {
          setState({ phase: 'locked', code })
          return
        }
        setState({
          phase: 'error',
          code,
          message: cause instanceof Error ? cause.message : 'Không thể tải lời giải.',
        })
      })

    return () => { active = false }
  }, [attempt, code, request])

  const pageState = state.code === code ? state : { phase: 'loading' as const, code }

  async function copySource(sourceCode: string) {
    try {
      await navigator.clipboard.writeText(sourceCode)
      setCopyMessage('Đã sao chép mã nguồn.')
    } catch {
      setCopyMessage('Không thể sao chép. Hãy chọn và sao chép mã nguồn trực tiếp.')
    }
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        {pageState.phase === 'loading' && (
          <section className={styles.statePanel} aria-live="polite">
            <span className={styles.stateIcon}><BookOpen size={22} aria-hidden="true" /></span>
            <h1>Đang tải lời giải</h1>
            <p>Vui lòng đợi trong giây lát.</p>
          </section>
        )}

        {pageState.phase === 'locked' && (
          <section className={styles.statePanel} aria-labelledby="locked-title">
            <span className={styles.stateIcon}><LockKeyhole size={22} aria-hidden="true" /></span>
            <p className={styles.eyebrow}>MỞ KHÓA LỜI GIẢI</p>
            <h1 id="locked-title">Bạn chưa thể xem lời giải</h1>
            <p>Bạn cần nộp bài và nhận kết quả chấm ít nhất một lần để mở khóa lời giải</p>
            <Link className={styles.primaryButton} to={`/problems/${encodeURIComponent(code)}/submit`}>Làm bài ngay</Link>
          </section>
        )}

        {pageState.phase === 'error' && (
          <section className={styles.statePanel} role="alert">
            <span className={styles.stateIcon}><BookOpen size={22} aria-hidden="true" /></span>
            <h1>Không thể tải lời giải</h1>
            <p>{pageState.message}</p>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setState({ phase: 'loading', code })
                setAttempt((value) => value + 1)
              }}
            >
              Thử lại
            </button>
          </section>
        )}

        {pageState.phase === 'ready' && (
          <>
            <header className={styles.pageHeader}>
              <h1>
                Lời giải của bài{' '}
                <Link
                  className={styles.problemLink}
                  to={`/problems/${encodeURIComponent(pageState.result.problem.code)}`}
                >
                  {pageState.result.problem.title}
                </Link>
              </h1>
            </header>

            {pageState.result.editorials.length === 0 ? (
              <section className={styles.statePanel} aria-labelledby="empty-title">
                <span className={styles.stateIcon}><BookOpen size={22} aria-hidden="true" /></span>
                <h2 id="empty-title">Chưa có lời giải</h2>
                <p>Lời giải cho bài tập này chưa được cập nhật. Bạn có thể quay lại sau.</p>
              </section>
            ) : (
              <section className={styles.solutionPanel} aria-label="Nội dung lời giải">
                {pageState.result.editorials.length > 1 && (
                  <div className={styles.tabs} role="tablist" aria-label="Chọn lời giải">
                    {pageState.result.editorials.map((editorial) => (
                      <button
                        key={editorial.id}
                        type="button"
                        role="tab"
                        aria-selected={selectedId === editorial.id}
                        aria-controls={`solution-${editorial.id}`}
                        id={`solution-tab-${editorial.id}`}
                        className={selectedId === editorial.id ? styles.activeTab : ''}
                        onClick={() => {
                          setSelectedId(editorial.id)
                          setCopyMessage('')
                        }}
                      >
                        {editorial.title}
                      </button>
                    ))}
                  </div>
                )}
                {pageState.result.editorials.filter((editorial) => editorial.id === selectedId).map((editorial) => (
                  <div
                    key={editorial.id}
                    className={styles.solutionContent}
                    id={`solution-${editorial.id}`}
                    role="tabpanel"
                    aria-labelledby={pageState.result.editorials.length > 1 ? `solution-tab-${editorial.id}` : undefined}
                    aria-label={pageState.result.editorials.length === 1 ? editorial.title : undefined}
                  >
                    <div className={styles.codeHeader}>
                      <div className={styles.solutionMeta}>
                        <h2>{editorial.title}</h2>
                        <span className={styles.languageBadge}>{editorial.language}</span>
                      </div>
                      <button className={styles.copyButton} type="button" onClick={() => void copySource(editorial.sourceCode)}>
                        {copyMessage.startsWith('Đã sao chép') ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                        Sao chép
                      </button>
                    </div>
                    {copyMessage && <p className={styles.copyMessage} role="status">{copyMessage}</p>}
                    <div className={styles.codeFrame}>
                      <Suspense fallback={<div className={styles.codeLoading} aria-live="polite">Đang mở trình hiển thị mã nguồn…</div>}>
                        <SolutionCodeViewer
                          sourceCode={editorial.sourceCode}
                          language={editorial.language}
                          title={editorial.title}
                        />
                      </Suspense>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ProblemSolutionPage
