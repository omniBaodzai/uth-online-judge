import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { describeError, useAdminQuery } from '../api'
import { Notice } from '../components'
import styles from '../admin.module.css'

type Features = { submissions: boolean; contests: boolean; organizations: boolean; comments: boolean; registration: boolean }
type Settings = { appName: string; smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpFrom: string; maxUploadMb: number; features: Features; smtpPasswordSet?: boolean }

const featureLabels: [keyof Features, string, boolean][] = [
  ['submissions', 'Nộp bài', true], ['registration', 'Đăng ký tài khoản mới', true],
  ['contests', 'Cuộc thi', false], ['organizations', 'Tổ chức', false], ['comments', 'Bình luận', false],
]

export default function AdminSettingsPage() {
  const { request } = useAuth()
  const loaded = useAdminQuery<Settings>('/api/admin/system/settings')
  const [draft, setDraft] = useState<Settings | null>(null)
  const form = draft ?? loaded.data
  const setForm = setDraft
  const [smtpPassword, setSmtpPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const { smtpPasswordSet: _ignored, ...body } = form
      const saved = await request<Settings>('/api/admin/system/settings', { method: 'PUT', body: JSON.stringify({ ...body, smtpPassword: smtpPassword || undefined }) })
      setForm(saved)
      setSmtpPassword('')
      setMessage('Đã lưu cài đặt.')
    } catch (reason) {
      setError(describeError(reason))
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((current) => ({ ...(current ?? loaded.data!), [key]: value }))

  return (
    <AdminLayout title="Cài đặt hệ thống" subtitle="Thông số ứng dụng, cấu hình email và bật/tắt các module.">
      <Notice kind="error">{error || loaded.error}</Notice>
      <Notice kind="success">{message}</Notice>
      {form && (
        <>
          <section className={styles.card}>
            <h3>Ứng dụng</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>Tên ứng dụng<input value={form.appName} maxLength={80} onChange={(event) => set('appName', event.target.value)} /></label>
              <label className={styles.field}>Dung lượng tải lên tối đa (MB)<input type="number" min={1} max={100} value={form.maxUploadMb} onChange={(event) => set('maxUploadMb', Number(event.target.value))} /></label>
            </div>
          </section>
          <section className={styles.card}>
            <h3>Email (SMTP)</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>Máy chủ<input value={form.smtpHost} onChange={(event) => set('smtpHost', event.target.value)} /></label>
              <label className={styles.field}>Cổng<input type="number" min={1} max={65535} value={form.smtpPort} onChange={(event) => set('smtpPort', Number(event.target.value))} /></label>
              <label className={styles.field}>Tài khoản<input value={form.smtpUser} autoComplete="off" onChange={(event) => set('smtpUser', event.target.value)} /></label>
              <label className={styles.field}>Mật khẩu {form.smtpPasswordSet && <span className={styles.muted}>(đã thiết lập — để trống nếu giữ nguyên)</span>}<input type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} /></label>
              <label className={styles.field}>Địa chỉ gửi<input value={form.smtpFrom} onChange={(event) => set('smtpFrom', event.target.value)} /></label>
            </div>
            <label className={styles.check} style={{ marginTop: 10 }}><input type="checkbox" checked={form.smtpSecure} onChange={(event) => set('smtpSecure', event.target.checked)} />Kết nối bảo mật (TLS)</label>
          </section>
          <section className={styles.card}>
            <h3>Module tính năng</h3>
            {featureLabels.map(([key, label, enforced]) => (
              <label key={key} className={styles.check} style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={form.features[key]} onChange={(event) => set('features', { ...form.features, [key]: event.target.checked })} />
                {label} {!enforced && <span className={styles.muted}>(chỉ lưu cấu hình, chưa được áp dụng ở máy chủ)</span>}
              </label>
            ))}
          </section>
          <button type="button" className={styles.btn} disabled={saving} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
        </>
      )}
    </AdminLayout>
  )
}
