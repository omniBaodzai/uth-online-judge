import { Suspense, lazy, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import { useAuth } from '../../auth/useAuth'
import { createSubmission } from '../../submissions/api'
import { problems } from '../data'
import { problemDetails } from '../data/problemDetails'
import { judge0LanguageIdByDisplayName, monacoLanguageByDisplayName, submissionLanguages } from '../data/submissionLanguages'
import styles from './ProblemSubmitPage.module.css'

const MonacoEditor = lazy(() => import('../components/CodeEditor'))

type ProblemSubmitPageProps = {
  problemId: string
}

function ProblemSubmitPage({ problemId }: ProblemSubmitPageProps) {
  const problem = problems.find((item) => item.id === problemId)
  const detail = problemDetails[problemId]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [language, setLanguage] = useState('C++20')
  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark'>('vs-dark')
  const [sourceCode, setSourceCode] = useState('')
  const [selectedFile, setSelectedFile] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [notice, setNotice] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { request, isAuthenticated } = useAuth()
  useEffect(() => {
    if (!isFullscreen) return
    function exitFullscreen(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', exitFullscreen)
    return () => window.removeEventListener('keydown', exitFullscreen)
  }, [isFullscreen])

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
        <nav className={styles.breadcrumb} aria-label="Điều hướng đường dẫn">
          <a href="/problems">Bài tập</a><span aria-hidden="true">/</span>
          <a href={`/problems/${problem.id}`}>{problem.id} · {problem.title}</a><span aria-hidden="true">/</span>
          <span>Nộp bài</span>
        </nav>

        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>GỬI LỜI GIẢI LÊN HỆ THỐNG</p>
            <h1>Nộp bài: <span>{problem.title}</span></h1>
            <p className={styles.problemMeta}>{problem.id} <i /> {detail.timeLimit} <i /> {detail.memoryLimit}</p>
          </div>
          <a className={styles.backLink} href={`/problems/${problem.id}`}>← Quay lại đề bài</a>
        </header>

        <form className={styles.submitForm} onSubmit={submitSolution}>
          <div className={styles.instructions}>
            <div>
              <strong>Dán bài làm của bạn ở đây hoặc nhập từ file:</strong>
              <span>{selectedFile || 'Chấp nhận tệp mã nguồn văn bản'}</span>
            </div>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept=".c,.cc,.cpp,.cxx,.h,.hpp,.java,.py,.cs,.go,.rs,.js,.txt"
              onChange={handleFileChange}
              aria-label="Chọn tệp mã nguồn"
            />
            <button className={styles.chooseFileButton} type="button" onClick={() => fileInputRef.current?.click()}>
              <span aria-hidden="true">↑</span> Chọn tệp
            </button>
          </div>

          <section className={`${styles.editorWorkspace} ${isFullscreen ? styles.fullscreenWorkspace : ''}`} aria-label="Trình soạn thảo bài giải">
            <div className={styles.editorToolbar}>
              <div className={styles.editorTitle}>
                <span className={styles.editorDot} />
                <strong>{selectedFile || `${problem.id}.${languageExtension(language)}`}</strong>
                <span>{language}</span>
              </div>
              <div className={styles.editorActions}>
                <button
                  className={styles.themeButton}
                  type="button"
                  aria-label={editorTheme === 'vs-dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                  onClick={() => setEditorTheme((current) => current === 'vs-dark' ? 'vs' : 'vs-dark')}
                >
                  <span aria-hidden="true">{editorTheme === 'vs-dark' ? '☼' : '◐'}</span>
                  {editorTheme === 'vs-dark' ? 'Tối' : 'Sáng'}
                </button>
                <button
                  className={styles.fullscreenButton}
                  type="button"
                  aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'}
                  onClick={() => setIsFullscreen((current) => !current)}
                >
                  <span aria-hidden="true">{isFullscreen ? '↙' : '↗'}</span>
                  {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                </button>
              </div>
            </div>

            <div className={styles.editorFrame}>
              <Suspense fallback={<div className={styles.editorLoading}>Đang tải Monaco Editor...</div>}>
                <MonacoEditor
                  height={isFullscreen ? 'calc(100dvh - 142px)' : 'min(540px, 58vh)'}
                  language={monacoLanguageByDisplayName[language] ?? 'plaintext'}
                  theme={editorTheme}
                  value={sourceCode}
                  onChange={(value) => {
                    setSourceCode(value)
                    if (sourceError) setSourceError('')
                    if (notice) setNotice('')
                  }}
                />
              </Suspense>
            </div>

            <div className={styles.editorFooter}>
              <label htmlFor="submit-language">Ngôn ngữ lập trình</label>
              <select id="submit-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {submissionLanguages.map((item) => <option key={item}>{item}</option>)}
              </select>
              <span className={styles.editorHint}>Tab để thụt lề <i /> Ctrl+Z để hoàn tác</span>
            </div>
          </section>

          {sourceError && <p className={styles.formError} role="alert">{sourceError}</p>}
          {notice && <p className={styles.formNotice} role="status">{notice}</p>}

          <div className={styles.formActions}>
            <a href={`/problems/${problem.id}`}>Hủy</a>
            <button className={styles.submitButton} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}><span aria-hidden="true">↑</span> {isSubmitting ? 'Đang gửi...' : 'Nộp bài!'}</button>
          </div>
        </form>
      </main>
    </div>
  )
}

function languageExtension(language: string) {
  const extensions: Record<string, string> = {
    'C17': 'c', 'C++17': 'cpp', 'C++20': 'cpp', 'Java 17': 'java',
    'Python 3': 'py', 'C# 12': 'cs', 'Go 1.23': 'go', 'Rust 1.82': 'rs', 'JavaScript': 'js',
  }
  return extensions[language] ?? 'txt'
}

export default ProblemSubmitPage