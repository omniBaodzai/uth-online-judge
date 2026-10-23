import { useId, useState, type KeyboardEvent } from 'react'
import { AdminIcon } from './AdminIcons'
import styles from '../admin.module.css'

type MultiValuePickerProps = {
  label: string
  placeholder: string
  suggestions: string[]
  values: string[]
  onChange: (values: string[]) => void
  allowCustom?: boolean
}

function MultiValuePicker({ label, placeholder, suggestions, values, onChange, allowCustom = true }: MultiValuePickerProps) {
  const inputId = useId()
  const [entry, setEntry] = useState('')
  const hasValue = (value: string) => values.some((item) => item.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0)

  function addValue(value = entry) {
    const trimmed = value.trim()
    if (!trimmed || hasValue(trimmed) || (!allowCustom && !suggestions.includes(trimmed))) {
      setEntry('')
      return
    }
    onChange([...values, trimmed])
    setEntry('')
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => item !== value))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addValue()
    }
  }

  return (
    <div className={styles.multiValuePicker} role="group" aria-labelledby={`${inputId}-label`}>
      <label className={styles.fieldLabel} id={`${inputId}-label`} htmlFor={inputId}>{label}</label>
      <div className={styles.multiValueControls}>
        {allowCustom ? (
          <input
            id={inputId}
            type="text"
            value={entry}
            maxLength={100}
            placeholder={placeholder}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <select id={inputId} value={entry} aria-describedby={`${inputId}-hint`} onChange={(event) => setEntry(event.target.value)}>
            <option value="">Chọn ngôn ngữ hỗ trợ</option>
            {suggestions.filter((suggestion) => !hasValue(suggestion)).map((suggestion) => <option key={suggestion} value={suggestion}>{suggestion}</option>)}
          </select>
        )}
        <button className={styles.buttonSecondary} type="button" disabled={!entry.trim()} onClick={() => addValue()}>
          <AdminIcon name="plus" size={15} /> Thêm
        </button>
      </div>
      <p className={styles.fieldHint} id={`${inputId}-hint`}>{allowCustom ? 'Nhập giá trị tùy chỉnh rồi nhấn Enter hoặc Thêm.' : 'Chỉ chọn ngôn ngữ đã được cấu hình trong hệ thống.'} Nhấn dấu × để bỏ mục đã chọn.</p>
      {values.length > 0 && (
        <div className={styles.multiValueChips} aria-label={`${label} đã chọn`}>
          {values.map((value) => (
            <span className={styles.valueChip} key={value}>
              {value}
              <button type="button" aria-label={`Xóa ${value} khỏi ${label}`} onClick={() => removeValue(value)}>
                <AdminIcon name="close" size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={styles.suggestionChips} aria-label={`${label} gợi ý`}>
        {suggestions.filter((suggestion) => !hasValue(suggestion)).map((suggestion) => (
          <button
            className={styles.suggestionChip}
            type="button"
            key={suggestion}
            aria-label={`Thêm ${suggestion} vào ${label}`}
            onClick={() => addValue(suggestion)}
          >
            <AdminIcon name="plus" size={13} /> {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

export default MultiValuePicker
