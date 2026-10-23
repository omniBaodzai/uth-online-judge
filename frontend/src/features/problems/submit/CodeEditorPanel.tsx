import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CodeEditor } from './MonacoEditor'
import { editorLanguages, getLanguage, isLanguageId, type LanguageId } from './languages'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { submitSolution } from './submission-service'
import styles from './CodeEditorPanel.module.css'

const MonacoEditor = lazy(() => import('./MonacoEditor'))

type Drafts = Record<LanguageId, string>

type Draft = { language: LanguageId; codes: Partial<Drafts> }

type CodeEditorPanelProps = {
  problemCode: string
  userId: string
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

function loadDraft(key: string): Draft | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { language, codes } = parsed as { language?: string; codes?: Record<string, unknown> }
    if (!isLanguageId(language ?? null) || !codes || typeof codes !== 'object') return null
    const safe: Partial<Drafts> = {}
    for (const item of editorLanguages) {
      if (typeof codes[item.id] === 'string') safe[item.id] = codes[item.id] as string
    }
    return { language: language as LanguageId, codes: safe }
  } catch {
    return null
  }
}

function CodeEditorPanel({ problemCode, userId }: CodeEditorPanelProps) {
  const key = draftKey(userId, problemCode)
  const [initialDraft] = useState(() => loadDraft(key))
  const [language, setLanguage] = useState<LanguageId>(initialDraft?.language ?? 'cpp')
  const [codes, setCodes] = useState<Partial<Drafts>>(initialDraft?.codes ?? {})
  const [fullscreen, setFullscreen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const editorRef = useRef<CodeEditor | null>(null)
  const { request } = useAuth()

  const current = getLanguage(language)
  const code = codes[language] ?? current.template
  const isModified = code !== current.template
  const canFormat = language === 'javascript'

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

  function changeLanguage(next: LanguageId) {
    setLanguage(next)
    setConfirmReset(false)
    setNotice('')
  }

  function requestReset() {
    if (isModified) setConfirmReset(true)
    else resetCode()
  }

  function resetCode() {
    setCodes((prev) => ({ ...prev, [language]: current.template }))
    setConfirmReset(false)
    setNotice('')
  }

  function formatCode() {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  async function handleSubmit() {
    setSubmitting(true)
    setNotice('')
    try {
      const result = await submitSolution(request, { problemCode, language, sourceCode: code })
      setNotice(`Đã ghi nhận bài giải (mã ${result.id}, trạng thái: đang chờ). Hệ thống chấm bài chưa được tích hợp nên bài chưa được chấm.`)
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : 'Không thể gửi bài giải. Vui lòng thử lại.')
    } finally {
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
              onChange={(event) => changeLanguage(event.target.value as LanguageId)}
            >
              {editorLanguages.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
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
              onChange={handleChange}
              onReady={handleReady}
            />
          </Suspense>
        </EditorBoundary>
      </div>

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <div className={styles.actions}>
        <span className={styles.currentLang}>Đang chọn: <strong>{current.label}</strong></span>
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
              disabled={submitting || !code.trim()}
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
