import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from './AdminIcons'
import { authMethodLabels, formatDateTime, roleLabels } from '../utils'
import type { AdminUser } from '../types'
import styles from '../admin.module.css'

type UserDetailDialogProps = {
  user: AdminUser
  onClose: () => void
}

export function UserDetailDialog({ user, onClose }: UserDetailDialogProps) {
  const { request } = useAdmin()
  const [detail, setDetail] = useState(user)
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    request<AdminUser>(`/admin/users/${user.id}`).then((fresh) => {
      if (active) setDetail(fresh)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải chi tiết người dùng.')
    })
    return () => { active = false }
  }, [request, user.id])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const rows: Array<[string, string]> = [
    ['Tên đăng nhập', detail.username || '—'],
    ['Email', detail.email],
    ['Họ và tên', detail.fullName || '—'],
    ['Vai trò', roleLabels[detail.role]],
    ['Trạng thái', detail.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hóa'],
    ['Phương thức đăng nhập', detail.authMethods.length ? detail.authMethods.map((method) => authMethodLabels[method]).join(', ') : '—'],
    ['Ngày đăng ký', formatDateTime(detail.createdAt)],
    ['Cập nhật gần nhất', formatDateTime(detail.updatedAt)],
  ]

  return (
    <div className={styles.dialogBackdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`${styles.dialog} ${styles.userDetail}`} role="dialog" aria-modal="true" aria-labelledby="user-detail-title" onKeyDown={handleKeyDown}>
        <div className={styles.userDetailHead}>
          <h2 id="user-detail-title">Chi tiết người dùng</h2>
          <button ref={closeRef} className={styles.iconButton} type="button" aria-label="Đóng" onClick={onClose}><AdminIcon name="close" size={16} /></button>
        </div>
        {error && <p className={styles.formMessage} role="alert">{error}</p>}
        <dl className={styles.detailList}>
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  )
}
