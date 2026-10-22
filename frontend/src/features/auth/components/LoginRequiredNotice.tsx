import styles from './LoginRequiredNotice.module.css'

type LoginRequiredNoticeProps = {
  title?: string
  message: string
  backHref?: string
  backLabel?: string
}

function LoginRequiredNotice({ title = 'Bạn cần đăng nhập', message, backHref, backLabel = 'Quay lại' }: LoginRequiredNoticeProps) {
  return (
    <section className={styles.notice} role="alert" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">🔒</span>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className={styles.actions}>
        <a className={styles.primary} href="/login">Đăng nhập</a>
        <a className={styles.secondary} href="/register">Đăng ký</a>
      </div>
      {backHref && <a className={styles.back} href={backHref}>← {backLabel}</a>}
    </section>
  )
}

export default LoginRequiredNotice
