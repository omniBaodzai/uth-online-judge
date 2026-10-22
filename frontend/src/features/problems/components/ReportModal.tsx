import { useEffect, useState, type FormEvent } from 'react'
import { reportTypes } from '../detail-data'
import styles from './ReportModal.module.css'

function ReportModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Giao diện minh họa: chưa gửi dữ liệu đến máy chủ.
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h2 id="report-title">Báo cáo vấn đề</h2>
        {sent ? (
          <>
            <p className={styles.success} role="status">
              Cảm ơn bạn! Báo cáo của bạn đã được ghi nhận (bản minh họa).
            </p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={onClose}>Đóng</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="report-type">Loại vấn đề</label>
            <select id="report-type" defaultValue={reportTypes[0]}>
              {reportTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <label htmlFor="report-description">Mô tả chi tiết</label>
            <textarea
              id="report-description"
              required
              rows={5}
              maxLength={1000}
              placeholder="Mô tả vấn đề bạn gặp phải..."
            />
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={onClose}>Hủy</button>
              <button className={styles.primary} type="submit">Gửi báo cáo</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ReportModal
