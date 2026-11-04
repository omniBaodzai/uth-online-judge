import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { monaco } from '../submit/monaco-setup'
import { useMonacoTheme } from '../submit/monaco-theme'
import { monacoLanguageId } from '../submit/languages'
import '../i18n'

type SolutionCodeViewerProps = {
  sourceCode: string
  language: string
  title: string
}

function SolutionCodeViewer({ sourceCode, language, title }: SolutionCodeViewerProps) {
  const { t } = useTranslation('pages')
  const containerRef = useRef<HTMLDivElement>(null)
  useMonacoTheme()
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
      ariaLabel: `${t('problemSourceCode')} ${initial.current.title}`,
    })
    editorRef.current = editor

    return () => {
      editor.dispose()
      editorRef.current = null
    }
  }, [t])

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
