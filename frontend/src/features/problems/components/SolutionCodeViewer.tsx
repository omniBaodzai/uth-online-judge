import { useEffect, useRef } from 'react'
import { monaco } from '../submit/monaco-setup'
import { monacoLanguageId } from '../submit/languages'

type SolutionCodeViewerProps = {
  sourceCode: string
  language: string
  title: string
}

function SolutionCodeViewer({ sourceCode, language, title }: SolutionCodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const initial = useRef({ sourceCode, language, title })
  const lineCount = sourceCode.split('\n').length
  const height = Math.min(Math.max(lineCount * 24 + 32, 180), 680)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const editor = monaco.editor.create(container, {
      value: initial.current.sourceCode,
      language: monacoLanguageId(initial.current.language),
      theme: 'uth-light',
      automaticLayout: true,
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      fontSize: 14,
      lineHeight: 24,
      tabSize: 4,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      padding: { top: 16, bottom: 16 },
      scrollbar: { horizontal: 'auto', vertical: 'auto', horizontalScrollbarSize: 10 },
      ariaLabel: `Mã nguồn ${initial.current.title}`,
    })
    editorRef.current = editor

    return () => {
      editor.dispose()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    if (model.getLanguageId() !== monacoLanguageId(language)) {
      monaco.editor.setModelLanguage(model, monacoLanguageId(language))
    }
    if (editor.getValue() !== sourceCode) editor.setValue(sourceCode)
  }, [language, sourceCode])

  return <div ref={containerRef} style={{ height }} />
}

export default SolutionCodeViewer
