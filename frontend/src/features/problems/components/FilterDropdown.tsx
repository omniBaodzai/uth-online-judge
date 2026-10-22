import { useEffect, useId, useRef, useState } from 'react'
import styles from './FilterDropdown.module.css'

type Option = { value: string; label: string }

type FilterDropdownProps = {
  label: string
  options: Option[]
  selected: string[]
  multiple?: boolean
  onChange: (selected: string[]) => void
}

function FilterDropdown({ label, options, selected, multiple = false, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function toggle(value: string) {
    if (multiple) {
      onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
    } else {
      onChange(selected.includes(value) ? [] : [value])
      setOpen(false)
    }
  }

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label)
  const summary =
    selectedLabels.length === 0
      ? ''
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} đã chọn`

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${selected.length ? styles.active : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        {summary && <span className={styles.value}>{summary}</span>}
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <ul
          className={styles.menu}
          id={menuId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple}
        >
          {options.map((option) => {
            const isSelected = selected.includes(option.value)
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                  onClick={() => toggle(option.value)}
                >
                  <span className={styles.check} aria-hidden="true" />
                  {option.label}
                </button>
              </li>
            )
          })}
          {selected.length > 0 && (
            <li role="presentation">
              <button type="button" className={styles.clear} onClick={() => onChange([])}>
                Bỏ chọn
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default FilterDropdown
