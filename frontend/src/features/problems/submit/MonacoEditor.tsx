import { memo, useEffect, useRef } from 'react'
import { monaco } from './monaco-setup'
import { areMonacoEditorRenderPropsEqual } from './monaco-editor-render'
import styles from './CodeEditorPanel.module.css'

export type CodeEditor = monaco.editor.IStandaloneCodeEditor

type MonacoEditorProps = {
  value: string
  language: string
  revision: number
  onChange: (value: string) => void
  onReady: (editor: CodeEditor | null) => void
}

function MonacoEditorView({ value, language, revision, onChange, onReady }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<CodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  const initial = useRef({ value, language, onReady })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const editor = monaco.editor.create(container, {
      value: initial.current.value,
      language: initial.current.language,
      theme: 'uth-light',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      padding: { top: 12, bottom: 12 },
      ariaLabel: 'Trình soạn thảo mã nguồn',
    })
    editorRef.current = editor
    const subscription = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()))
    const notifyReady = initial.current.onReady
    notifyReady(editor)
    return () => {
      subscription.dispose()
      notifyReady(null)
      editor.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    if (model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language)
    if (editor.getValue() !== value) editor.setValue(value)
  }, [language, revision])

  return <div ref={containerRef} className={styles.monaco} />
}

const MonacoEditor = memo(
  MonacoEditorView,
  (previous, next) => areMonacoEditorRenderPropsEqual(previous, next),
)

export default MonacoEditor
