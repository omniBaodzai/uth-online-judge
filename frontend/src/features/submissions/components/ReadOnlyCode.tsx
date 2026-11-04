import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { monaco } from '../../problems/submit/monaco-setup'
import { useMonacoTheme } from '../../problems/submit/monaco-theme'
import '../i18n'
import styles from './ReadOnlyCode.module.css'

type ReadOnlyCodeProps = {
  code: string
  language: string
}

function ReadOnlyCode({ code, language }: ReadOnlyCodeProps) {
  const { t } = useTranslation('pages')
  const containerRef = useRef<HTMLDivElement>(null)
  useMonacoTheme()
  const height = Math.min(560, Math.max(112, code.split('\n').length * 20 + 24))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const editor = monaco.editor.create(container, {
      value: code,
      language,
      readOnly: true,
      domReadOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 4,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'none',
      padding: { top: 12, bottom: 12 },
      ariaLabel: t('submissionsReadonlyCodeLabel'),
    })

    return () => editor.dispose()
  }, [code, language, t])

  return <div ref={containerRef} className={styles.editor} style={{ height }} />
}

export default ReadOnlyCode
