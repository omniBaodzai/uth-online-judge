import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { CodeEditor } from './MonacoEditor'
import { describeLanguage } from './languages'
import { useAuth } from '../../auth/useAuth'
import { describeSubmissionFailure } from './submission-failure'
import { submitSolution } from './submission-service'
import styles from './CodeEditorPanel.module.css'

const MonacoEditor = lazy(() => import('./MonacoEditor'))

export type AllowedLanguage = { slug: string; name: string }

type Drafts = Record<string, string>

type Draft = { language: string; codes: Drafts }

type CodeEditorPanelProps = {
  problemCode: string
  userId: string
  languages: AllowedLanguage[]
}

class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={styles.editorState} role="alert">
        <p>Không thể tải trình soạn thảo code.</p>
        <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
      </div>
    )
  }
}

function draftKey(userId: string, problemCode: string) {
  return `uth_draft:${userId}:${problemCode}`
}

// Chỉ giữ lại bản nháp của những ngôn ngữ bài tập hiện đang cho phép.
function loadDraft(key: string, allowed: AllowedLanguage[]): Draft | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { language, codes } = parsed as { language?: string; codes?: Record<string, unknown> }
    if (!codes || typeof codes !== 'object') return null
    const safe: Drafts = {}
    for (const item of allowed) {
      if (typeof codes[item.slug] === 'string') safe[item.slug] = codes[item.slug] as string
    }
    const selected = allowed.some((item) => item.slug === language) ? (language as string) : allowed[0]?.slug
    return selected ? { language: selected, codes: safe } : null
  } catch {
    return null
  }
}

function CodeEditorPanel({ problemCode, userId, languages }: CodeEditorPanelProps) {
  const key = draftKey(userId, problemCode)
  const [initialDraft] = useState(() => loadDraft(key, languages))
  const [language, setLanguage] = useState<string>(initialDraft?.language ?? languages[0]?.slug ?? '')
  const [codes, setCodes] = useState<Drafts>(initialDraft?.codes ?? {})
  const [editorRevision, setEditorRevision] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [uncertainSubmissionId, setUncertainSubmissionId] = useState<string>()
  const submittingRef = useRef(false)
  const editorRef = useRef<CodeEditor | null>(null)
  const { request } = useAuth()
  const navigate = useNavigate()

  const selected = languages.find((item) => item.slug === language)
  const current = describeLanguage(selected?.name ?? '')
  const code = codes[language] ?? current.template
  const isModified = code !== current.template
  const canFormat = current.monacoId === 'javascript'

  // Lưu bản nháp mã nguồn ở trình duyệt (không chứa token hay thông tin xác thực).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ language, codes } satisfies Draft))
      } catch {
        // Bỏ qua khi bộ nhớ đầy hoặc bị chặn.
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [key, language, codes])

  useEffect(() => {
    if (!fullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [fullscreen])

  const handleChange = useCallback(
    (value: string) => setCodes((prev) => (prev[language] === value ? prev : { ...prev, [language]: value })),
    [language],
  )

  const handleReady = useCallback((editor: CodeEditor | null) => {
    editorRef.current = editor
  }, [])

  function changeLanguage(next: string) {
    setLanguage(next)
    setConfirmReset(false)
    setNotice('')
    setUncertainSubmissionId(undefined)
  }

  function requestReset() {
    if (isModified) setConfirmReset(true)
    else resetCode()
  }

  function resetCode() {
    setCodes((prev) => ({ ...prev, [language]: current.template }))
    setEditorRevision((revision) => revision + 1)
    setConfirmReset(false)
    setNotice('')
  }

  function formatCode() {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  async function handleSubmit() {
    if (!selected || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setNotice('')
    setUncertainSubmissionId(undefined)
    try {
      const result = await submitSolution(request, { problemCode, language: selected.slug, sourceCode: code })
      navigate(`/submissions/${encodeURIComponent(result.id)}`)
    } catch (error) {
      const failure = describeSubmissionFailure(error)
      setNotice(failure.message)
      setUncertainSubmissionId(failure.submissionId)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <section
      className={`${styles.panel} ${fullscreen ? styles.fullscreen : ''}`}
      aria-label="Trình soạn thảo code"
    >
      <div className={styles.toolbar}>
        <div className={styles.langGroup}>
          <label htmlFor="language-select">Ngôn ngữ</label>
          <div className={styles.selectWrap}>
            <select
              id="language-select"
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
              disabled={languages.length === 0}
            >
              {languages.length === 0 && <option value="">Chưa có ngôn ngữ</option>}
              {languages.map((item) => (
                <option key={item.slug} value={item.slug}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.toolButtons}>
          <button
            type="button"
            onClick={formatCode}
            disabled={!canFormat}
            title={canFormat ? 'Định dạng code' : 'Định dạng tự động hiện chỉ hỗ trợ JavaScript'}
          >
            Định dạng
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((value) => !value)}
            aria-pressed={fullscreen}
          >
            {fullscreen ? 'Thu nhỏ' : 'Phóng to'}
          </button>
        </div>
      </div>

      <div className={styles.editorArea}>
        <EditorBoundary>
          <Suspense fallback={<div className={styles.editorState} role="status">Đang tải trình soạn thảo…</div>}>
            <MonacoEditor
              value={code}
              language={current.monacoId}
              revision={editorRevision}
              onChange={handleChange}
              onReady={handleReady}
            />
          </Suspense>
        </EditorBoundary>
      </div>

      {languages.length === 0 && (
        <p className={styles.notice} role="alert">Bài tập này chưa được cấu hình ngôn ngữ nộp bài. Vui lòng liên hệ quản trị viên.</p>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          <p>{notice}</p>
          {uncertainSubmissionId && (
            <Link to={`/submissions/${encodeURIComponent(uncertainSubmissionId)}`}>
              Kiểm tra bài nộp đã lưu
            </Link>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <span className={styles.currentLang}>Đang chọn: <strong>{selected ? current.label : '—'}</strong></span>
        {confirmReset ? (
          <div className={styles.confirm} role="alert">
            <span>Đặt lại sẽ xóa code bạn đã viết. Tiếp tục?</span>
            <button type="button" className={styles.danger} onClick={resetCode}>Đặt lại</button>
            <button type="button" onClick={() => setConfirmReset(false)}>Giữ code</button>
          </div>
        ) : (
          <div className={styles.actionButtons}>
            <button type="button" onClick={requestReset} disabled={submitting}>Đặt lại code</button>
            <button
              type="button"
              className={styles.primary}
              onClick={handleSubmit}
              disabled={submitting || !selected || !code.trim()}
            >
              {submitting ? 'Đang gửi…' : 'Gửi bài giải'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default CodeEditorPanel
