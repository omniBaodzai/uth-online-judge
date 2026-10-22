import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

loader.config({ monaco })

type CodeEditorProps = {
  height: string
  language: string
  theme: 'vs' | 'vs-dark'
  value: string
  onChange: (value: string) => void
}

function CodeEditor({ height, language, theme, value, onChange }: CodeEditorProps) {
  return (
    <Editor
      height={height}
      language={language}
      theme={theme}
      value={value}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      options={{
        ariaLabel: 'Mã nguồn bài giải',
        automaticLayout: true,
        fontSize: 13,
        lineNumbers: 'on',
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        quickSuggestions: true,
        scrollBeyondLastLine: false,
        suggestOnTriggerCharacters: true,
        tabSize: 4,
        wordWrap: 'on',
      }}
    />
  )
}

export default CodeEditor