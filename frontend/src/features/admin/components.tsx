import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import styles from './admin.module.css'

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className={styles.pager}>
      <span>{total} mục</span>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={14} aria-hidden="true" />Trước</button>
      <span>Trang {page}/{pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau<ChevronRight size={14} aria-hidden="true" /></button>
    </div>
  )
}

export function Notice({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  if (!children) return null
  return <p className={kind === 'error' ? styles.error : styles.success} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div className={wide ? `${styles.modal} ${styles.modalWide}` : styles.modal}>
        <header>
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} aria-hidden="true" /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'blue' | 'gray'; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
