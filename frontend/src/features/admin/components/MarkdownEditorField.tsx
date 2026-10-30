import { useRef } from 'react'
import Markdown from '../../../components/ui/Markdown'
import styles from './MarkdownEditorField.module.css'

type Format = {
  label: string
  description: string
  prefix: string
  suffix?: string
  placeholder?: string
  lines?: boolean
}

const formats: Format[] = [
  { label: 'B', description: 'In đậm', prefix: '**', suffix: '**', placeholder: 'chữ đậm' },
  { label: 'I', description: 'In nghiêng', prefix: '*', suffix: '*', placeholder: 'chữ nghiêng' },
  { label: 'S', description: 'Gạch ngang', prefix: '~~', suffix: '~~', placeholder: 'nội dung' },
  { label: 'U', description: 'Gạch chân', prefix: '++', suffix: '++', placeholder: 'nội dung' },
  { label: 'H2', description: 'Tiêu đề', prefix: '## ', lines: true },
  { label: '• Danh sách', description: 'Danh sách dấu đầu dòng', prefix: '- ', lines: true },
  { label: '1. Danh sách', description: 'Danh sách đánh số', prefix: '1. ', lines: true },
  { label: '` Code', description: 'Mã nguồn', prefix: '`', suffix: '`', placeholder: 'code' },
  { label: 'ƒx Toán', description: 'Công thức LaTeX', prefix: '$', suffix: '$', placeholder: 'x^2 + y^2' },
]

function MarkdownEditorField({
  id,
  label,
  value,
  onChange,
  required = false,
  rows = 6,
  fullWidth = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  rows?: number
  fullWidth?: boolean
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)

  function applyFormat(format: Format) {
    const input = textarea.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? start
    const selected = value.slice(start, end)

    if (format.lines) {
      const replacement = selected
        ? selected.split('\n').map((line) => `${format.prefix}${line}`).join('\n')
        : format.prefix
      onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`)
      requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(start + replacement.length, start + replacement.length)
      })
      return
    }

    const content = selected || format.placeholder || ''
    const replacement = `${format.prefix}${content}${format.suffix ?? ''}`
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`)
    requestAnimationFrame(() => {
      input?.focus()
      if (selected) {
        input?.setSelectionRange(start, start + replacement.length)
      } else {
        const contentStart = start + format.prefix.length
        input?.setSelectionRange(contentStart, contentStart + content.length)
      }
    })
  }

  return (
    <div className={`${styles.field} ${fullWidth ? styles.fullWidth : ''}`}>
      <label htmlFor={id}>{label}{required && <span className={styles.required}> *</span>}</label>
      <div className={styles.editor}>
        <div className={styles.toolbar} role="toolbar" aria-label={`Định dạng ${label}`}>
          {formats.map((format) => (
            <button
              key={format.description}
              type="button"
              title={format.description}
              aria-label={format.description}
              onClick={() => applyFormat(format)}
            >
              {format.label}
            </button>
          ))}
        </div>
        <div className={styles.columns}>
          <textarea
            ref={textarea}
            id={id}
            required={required}
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={`${id}-markdown-help`}
          />
          <div className={styles.preview} aria-label={`Xem trước ${label}`}>
            <p className={styles.previewLabel}>Xem trước trực tiếp</p>
            {value.trim()
              ? <Markdown source={value} math />
              : <p className={styles.placeholder}>Nội dung xem trước sẽ hiển thị tại đây.</p>}
          </div>
        </div>
      </div>
      <p className={styles.hint} id={`${id}-markdown-help`}>
        Hỗ trợ Markdown, LaTeX; gạch chân dùng cú pháp ++nội dung++.
      </p>
    </div>
  )
}

export default MarkdownEditorField
