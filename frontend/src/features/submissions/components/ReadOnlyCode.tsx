import { useEffect, useRef } from 'react'
import { monaco } from '../../problems/submit/monaco-setup'
import styles from './ReadOnlyCode.module.css'

type ReadOnlyCodeProps = {
  code: string
  language: string
}

function ReadOnlyCode({ code, language }: ReadOnlyCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const height = Math.min(560, Math.max(112, code.split('\n').length * 20 + 24))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const editor = monaco.editor.create(container, {
      value: code,
      language,
      theme: 'uth-light',
      readOnly: true,
      domReadOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 4,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'none',
      padding: { top: 12, bottom: 12 },
      ariaLabel: 'Mã nguồn bài nộp chỉ đọc',
    })

    return () => editor.dispose()
  }, [code, language])

  return <div ref={containerRef} className={styles.editor} style={{ height }} />
}

export default ReadOnlyCode
