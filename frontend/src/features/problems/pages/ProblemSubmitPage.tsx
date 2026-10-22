import { Suspense, lazy, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type * as Monaco from 'monaco-editor'
import { useNavigate } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import LoginRequiredNotice from '../../auth/components/LoginRequiredNotice'
import { createSubmission, hasAcceptedSubmission } from '../../submissions/api'
import ProblemSample from '../components/ProblemSample'
import { useProblem } from '../problemCatalog'
import { codeTemplateByDisplayName, judge0LanguageIdByDisplayName, monacoLanguageByDisplayName, submissionLanguages } from '../data/submissionLanguages'
import styles from './ProblemSubmitPage.module.css'

const MonacoEditor = lazy(() => import('../components/CodeEditor'))

type ProblemSubmitPageProps = {
  problemId: string
}

function ProblemSubmitPage({ problemId }: ProblemSubmitPageProps) {
  const catalogState = useProblem(problemId)
  const problem = catalogState.status === 'ready' ? catalogState.problem : undefined
  const detail = catalogState.status === 'ready' ? catalogState.detail : undefined
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [language, setLanguage] = useState('C++20')
  const [sourceCode, setSourceCode] = useState(codeTemplateByDisplayName['C++20'])
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const [isSolved, setIsSolved] = useState<boolean | null>(null)
  const [selectedFile, setSelectedFile] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [notice, setNotice] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { request, isAuthenticated, isLoading } = useAuth()
  const requestRef = useRef(request)
  useEffect(() => {
    requestRef.current = request
  }, [request])
  useEffect(() => {
    if (!isAuthenticated || !problem) return
    let cancelled = false
    hasAcceptedSubmission(requestRef.current, problem.id)
      .then((solved) => { if (!cancelled) setIsSolved(solved) })
      .catch(() => { if (!cancelled) setIsSolved(null) })
    return () => { cancelled = true }
  }, [isAuthenticated, problem])
  useEffect(() => {
    if (!isFullscreen) return
    function exitFullscreen(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', exitFullscreen)
    return () => window.removeEventListener('keydown', exitFullscreen)
  }, [isFullscreen])

  if (catalogState.status === 'loading') {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.main}><p>Đang tải đề bài…</p></main>
      </div>
    )
  }

  if (!problem || !detail) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.notFound}>
          <p>UTH ONLINE JUDGE</p>
          <h1>Không tìm thấy bài tập</h1>
          <span>Mã bài <strong>{problemId}</strong> không tồn tại hoặc chưa có nội dung.</span>
          <a href="/problems">Quay lại danh sách bài tập</a>
        </main>
      </div>
    )
  }

  const currentProblemId = problem.id

  if (isLoading) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.main}><p>Đang kiểm tra phiên đăng nhập…</p></main>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.main}>
          <LoginRequiredNotice
            message={`Vui lòng đăng nhập hoặc đăng ký tài khoản để nộp bài ${problem.id}.`}
            backHref={`/problems/${problem.id}`}
            backLabel="Quay lại đề bài"
          />
        </main>
      </div>
    )
  }

  function changeLanguage(next: string) {
    const isUntouched = !sourceCode.trim() || sourceCode === codeTemplateByDisplayName[language]
    setLanguage(next)
    if (isUntouched) setSourceCode(codeTemplateByDisplayName[next] ?? '')
  }

  function resetCode() {
    setSourceCode(codeTemplateByDisplayName[language] ?? '')
    setSelectedFile('')
    setSourceError('')
    setNotice('')
  }

  function formatCode() {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSourceCode(await file.text())
      setSelectedFile(file.name)
      setSourceError('')
      setNotice('')

      const extension = file.name.split('.').pop()?.toLowerCase()
      const detectedLanguage: Record<string, string> = {
        c: 'C17',
        cc: 'C++20',
        cpp: 'C++20',
        cxx: 'C++20',
        java: 'Java 17',
        py: 'Python 3',
        cs: 'C# 12',
        go: 'Go 1.23',
        rs: 'Rust 1.82',
        js: 'JavaScript',
      }
      if (extension && detectedLanguage[extension]) setLanguage(detectedLanguage[extension])
    } catch {
      setSourceError('Không thể đọc tệp đã chọn. Hãy thử lại hoặc dán mã nguồn trực tiếp.')
    }

    event.target.value = ''
  }

  async function submitSolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (!sourceCode.trim()) {
      setSourceError('Vui lòng nhập mã nguồn hoặc chọn tệp trước khi nộp bài.')
      setNotice('')
      return
    }
    if (!isAuthenticated) {
      setSourceError('Vui lòng đăng nhập để nộp bài.')
      return
    }

    setSourceError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      const created = await createSubmission(request, {
        problemCode: currentProblemId,
        sourceCode,
        languageId: judge0LanguageIdByDisplayName[language],
      })
      navigate(`/submissions/${created.id}`)
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : 'Không thể gửi bài nộp. Vui lòng thử lại.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.split}>
          <article className={`${styles.panel} ${styles.statement}`} aria-label="Đề bài">
            <a className={styles.backLink} href={`/problems/${problem.id}`}>← Quay lại chi tiết bài tập</a>
            <div className={styles.titleRow}>
              <h1><strong>{problem.id}</strong> — {problem.title}</h1>
              {isSolved !== null && (
                <span className={`${styles.solvedBadge} ${isSolved ? '' : styles.unsolvedBadge}`}>
                  {isSolved ? '✓ Đã làm' : 'Chưa làm'}
                </span>
              )}
            </div>
            <div className={styles.meta}>
              <span>{detail.timeLimit}</span>
              <span>{detail.memoryLimit}</span>
              <span>{problem.score.toFixed(2)} điểm</span>
            </div>

            <section className={styles.section}>
              <h2>Đề bài</h2>
              {detail.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
            <section className={styles.section}>
              <h2>Đầu vào (Input)</h2>
              <p>{detail.input}</p>
            </section>
            <section className={styles.section}>
              <h2>Giới hạn (Constraints)</h2>
              <ul className={styles.constraints}>
                {detail.constraints.map((constraint) => <li key={constraint}><code>{constraint}</code></li>)}
              </ul>
            </section>
            <section className={styles.section}>
              <h2>Đầu ra (Output)</h2>
              <p>{detail.output}</p>
            </section>
            <section className={styles.section}>
              <h2>Ví dụ</h2>
              {detail.examples.map((example, index) => (
                <ProblemSample example={example} index={index} key={`${problem.id}-sample-${index}`} />
              ))}
            </section>
          </article>

          <form className={`${styles.panel} ${styles.workspace} ${isFullscreen ? styles.fullscreenWorkspace : ''}`} onSubmit={submitSolution} aria-label="Khu vực làm bài">
            <div className={styles.toolbar}>
              <label className={styles.langLabel} htmlFor="submit-language">NGÔN NGỮ</label>
              <select id="submit-language" value={language} onChange={(event) => changeLanguage(event.target.value)}>
                {submissionLanguages.map((item) => <option key={item}>{item}</option>)}
              </select>
              <div className={styles.toolbarActions}>
                <input
                  ref={fileInputRef}
                  className={styles.fileInput}
                  type="file"
                  accept=".c,.cc,.cpp,.cxx,.h,.hpp,.java,.py,.cs,.go,.rs,.js,.txt"
                  onChange={handleFileChange}
                  aria-label="Chọn tệp mã nguồn"
                />
                <button className={styles.toolButton} type="button" onClick={() => fileInputRef.current?.click()}>Chọn tệp</button>
                <button className={styles.toolButton} type="button" onClick={formatCode}>Định dạng</button>
                <button className={styles.toolButton} type="button" onClick={() => setIsFullscreen((current) => !current)}>
                  {isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
                </button>
              </div>
            </div>

            <div className={styles.editorFrame}>
              <Suspense fallback={<div className={styles.editorLoading}>Đang tải Monaco Editor...</div>}>
                <MonacoEditor
                  height="100%"
                  language={monacoLanguageByDisplayName[language] ?? 'plaintext'}
                  theme="vs"
                  value={sourceCode}
                  onMount={(editor) => { editorRef.current = editor }}
                  onChange={(value) => {
                    setSourceCode(value)
                    if (sourceError) setSourceError('')
                  }}
                />
              </Suspense>
            </div>

            {sourceError && <p className={styles.formError} role="alert">{sourceError}</p>}
            {notice && <p className={styles.formNotice} role="status">{notice}</p>}

            <div className={styles.footerBar}>
              <span className={styles.currentLanguage}>Đang chọn: <strong>{language}</strong>{selectedFile ? ` · ${selectedFile}` : ''}</span>
              <div className={styles.footerActions}>
                <button className={styles.toolButton} type="button" onClick={resetCode}>Đặt lại code</button>
                <button className={styles.submitButton} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? 'Đang gửi...' : 'Gửi bài giải'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
export default ProblemSubmitPage