import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { RequireAuth } from '../../auth/components/RequireAuth'
import styles from './ProfilePage.module.css'

type ProfilePageProps = {
  edit?: boolean
}

function ProfilePage({ edit = false }: ProfilePageProps) {
  const { user, updateProfile } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    const formData = new FormData(event.currentTarget)
    try {
      await updateProfile({
        fullName: String(formData.get('fullName') ?? '').trim() || null,
        avatarUrl: String(formData.get('avatarUrl') ?? '').trim() || null,
      })
      setNotice('Hồ sơ đã được cập nhật.')
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : 'Không thể lưu hồ sơ. Vui lòng thử lại.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main} id="main-content">
        <RequireAuth>
          <section className={styles.card} aria-labelledby="profile-title">
            <div className={styles.heading}>
              <p className={styles.eyebrow}>Tài khoản UTH Online Judge</p>
              <h1 id="profile-title">{edit ? 'Chỉnh sửa hồ sơ' : 'Thông tin cá nhân'}</h1>
              <p>Quản lý thông tin hồ sơ dùng trong cộng đồng học lập trình.</p>
            </div>

            {error && !user ? (
              <div className={styles.feedback} role="alert">{error}</div>
            ) : user ? (
              <>
                {user.avatar_url && (
                  <img className={styles.avatar} src={user.avatar_url} alt="Ảnh đại diện" />
                )}
                {edit ? (
                  <form className={styles.form} onSubmit={handleSubmit}>
                    <label htmlFor="profile-username">Tên đăng nhập</label>
                    <input id="profile-username" value={user.username ?? ''} disabled />
                    <label htmlFor="profile-email">Email</label>
                    <input id="profile-email" type="email" value={user.email} disabled />
                    <label htmlFor="profile-full-name">Họ và tên</label>
                    <input
                      id="profile-full-name"
                      name="fullName"
                      defaultValue={user.full_name ?? ''}
                      maxLength={100}
                      autoComplete="name"
                    />
                    <label htmlFor="profile-avatar-url">Đường dẫn ảnh đại diện</label>
                    <input
                      id="profile-avatar-url"
                      name="avatarUrl"
                      type="url"
                      defaultValue={user.avatar_url ?? ''}
                      maxLength={2048}
                      placeholder="https://example.com/avatar.png"
                    />
                    {error && <p className={styles.feedback} role="alert">{error}</p>}
                    {notice && <p className={styles.success} role="status">{notice}</p>}
                    <div className={styles.actions}>
                      <Link className={styles.secondaryButton} to="/profile">Hủy</Link>
                      <button className={styles.primaryButton} type="submit" disabled={isSaving}>
                        {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className={styles.details}>
                    <div><dt>Tên đăng nhập</dt><dd>{user.username ?? 'Chưa thiết lập'}</dd></div>
                    <div><dt>Email</dt><dd>{user.email}</dd></div>
                    <div><dt>Họ và tên</dt><dd>{user.full_name || 'Chưa cập nhật'}</dd></div>
                    <div>
                      <dt>Ngày tham gia</dt>
                      <dd>{new Date(user.created_at).toLocaleDateString('vi-VN')}</dd>
                    </div>
                  </dl>
                )}
                {!edit && (
                  <Link className={styles.primaryButton} to="/profile/edit">
                    Chỉnh sửa hồ sơ
                  </Link>
                )}
              </>
            ) : null}
          </section>
        </RequireAuth>
      </main>
    </div>
  )
}

export default ProfilePage
