import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import { ApiError, resolveAvatarUrl, type AuthUser } from '../../auth/api'
import { RequireAuth } from '../../auth/components/RequireAuth'
import { useAuth } from '../../auth/useAuth'
import UserAvatar from '../components/UserAvatar'
import styles from './AccountProfilePage.module.css'

type AccountProfilePageProps = {
  edit?: boolean
}

function AccountProfilePage({ edit = false }: AccountProfilePageProps) {
  const { user } = useAuth()

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <RequireAuth>
          {user ? <ProfileContent user={user} edit={edit} /> : null}
        </RequireAuth>
      </main>
    </div>
  )
}

function ProfileContent({ user, edit }: { user: AuthUser; edit: boolean }) {
  const { updateProfile, uploadAvatar } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewObjectUrl = useRef<string | null>(null)
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(resolveAvatarUrl(user.avatar_url) ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>('url')
  const [previewUrl, setPreviewUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const displayedAvatar = previewUrl || resolveAvatarUrl(avatarUrl) || resolveAvatarUrl(user.avatar_url)

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
  }, [])

  function clearPreview() {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    previewObjectUrl.current = null
    setPreviewUrl('')
  }

  function changeAvatarMode(mode: 'url' | 'upload') {
    setAvatarMode(mode)
    setAvatarFile(null)
    clearPreview()
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(file: File | undefined) {
    setError('')
    setNotice('')
    clearPreview()
    if (!file) {
      setAvatarFile(null)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setError('Ảnh đại diện phải có dung lượng tối đa 2 MB.')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    previewObjectUrl.current = objectUrl
    setPreviewUrl(objectUrl)
    setAvatarFile(file)
    setAvatarMode('upload')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      if (avatarMode === 'upload' && avatarFile) {
        await uploadAvatar(avatarFile, fullName.trim() || null)
      } else {
        await updateProfile({
          fullName: fullName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        })
      }
      setAvatarFile(null)
      clearPreview()
      setNotice('Hồ sơ đã được cập nhật.')
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="account-profile-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>TÀI KHOẢN UTH ONLINE JUDGE</p>
        <h1 id="account-profile-title">{edit ? 'Chỉnh sửa hồ sơ' : 'Thông tin cá nhân'}</h1>
        <p>Quản lý thông tin hồ sơ dùng trong cộng đồng học lập trình.</p>
      </div>

      <div className={styles.identity}>
        <UserAvatar source={resolveAvatarUrl(user.avatar_url)} username={user.username ?? user.email} size="large" />
        <div><strong>{user.full_name || user.username || user.email}</strong><span>{user.username ? `@${user.username}` : user.email}</span></div>
      </div>

      {edit ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="account-username">Tên đăng nhập</label>
          <input id="account-username" value={user.username ?? ''} disabled />
          <label htmlFor="account-email">Email</label>
          <input id="account-email" type="email" value={user.email} disabled />
          <label htmlFor="account-full-name">Họ và tên</label>
          <input id="account-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} autoComplete="name" />

          <fieldset className={styles.avatarFieldset}>
            <legend>Ảnh đại diện</legend>
            <div className={styles.modeChoices}>
              <label><input type="radio" name="avatar-mode" checked={avatarMode === 'url'} onChange={() => changeAvatarMode('url')} /> Dùng URL</label>
              <label><input type="radio" name="avatar-mode" checked={avatarMode === 'upload'} onChange={() => changeAvatarMode('upload')} /> Tải ảnh lên</label>
            </div>
            {avatarMode === 'url' ? (
              <>
                <label htmlFor="account-avatar-url">Đường dẫn ảnh (HTTP hoặc HTTPS)</label>
                <input id="account-avatar-url" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://example.com/avatar.png" />
              </>
            ) : (
              <>
                <label htmlFor="account-avatar-file">Chọn ảnh (PNG, JPEG, WebP hoặc GIF)</label>
                <input ref={fileInputRef} id="account-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleFileChange(event.currentTarget.files?.[0])} />
                <p className={styles.helperText}>Dung lượng tối đa 2 MB.</p>
              </>
            )}
            <div className={styles.avatarPreview}>
              <UserAvatar source={displayedAvatar} username={user.username ?? user.email} size="large" label="Ảnh xem trước" />
              <span>{previewUrl ? 'Ảnh đã sẵn sàng xem trước.' : 'Ảnh đại diện hiện tại hoặc ảnh mặc định.'}</span>
            </div>
          </fieldset>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.success} role="status">{notice}</p>}
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/profile">Hủy</Link>
            <button className={styles.primaryButton} type="submit" disabled={isSaving || (avatarMode === 'upload' && !avatarFile)}>{isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </div>
        </form>
      ) : (
        <>
          <dl className={styles.details}>
            <div><dt>Tên đăng nhập</dt><dd>{user.username ?? 'Chưa thiết lập'}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Họ và tên</dt><dd>{user.full_name || 'Chưa cập nhật'}</dd></div>
            <div><dt>Ngày tham gia</dt><dd>{new Date(user.created_at).toLocaleDateString('vi-VN')}</dd></div>
          </dl>
          <Link className={styles.primaryButton} to="/profile/edit">Chỉnh sửa hồ sơ</Link>
        </>
      )}
    </section>
  )
}

export default AccountProfilePage