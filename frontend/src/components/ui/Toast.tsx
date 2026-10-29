import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toast-context'
import styles from './Toast.module.css'

const TOAST_DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const counter = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string) => {
    window.clearTimeout(timer.current)
    counter.current += 1
    setToast({ id: counter.current, message })
    timer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toast ? (
          <div className={styles.toast} key={toast.id}>
            <span>{toast.message}</span>
            <button className={styles.close} type="button" aria-label="Đóng thông báo" onClick={dismiss}>
              ×
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}
