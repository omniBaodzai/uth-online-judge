import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../../components/layout/SiteHeader'
import { ApiError, resolveAvatarUrl, type AuthUser } from '../../auth/api'
import { RequireAuth } from '../../auth/components/RequireAuth'
import { useAuth } from '../../auth/useAuth'
import AvatarCropModal from '../components/AvatarCropModal'
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES } from '../avatar-constants'
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
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(resolveAvatarUrl(user.avatar_url) ?? '')
  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>('url')
  const [cropUrl, setCropUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const displayedAvatar = resolveAvatarUrl(avatarUrl) || resolveAvatarUrl(user.avatar_url)

  function changeAvatarMode(mode: 'url' | 'upload') {
    setAvatarMode(mode)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(file: File | undefined) {
    setError('')
    setNotice('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Ảnh đại diện phải có dung lượng tối đa 2 MB.')
      return
    }
    setCropUrl(URL.createObjectURL(file))
  }

  function closeCropModal() {
    URL.revokeObjectURL(cropUrl)
    setCropUrl('')
  }

  // Chỉ tải lên ảnh đã cắt; giữ nguyên họ tên đã lưu để không lưu nhầm bản nháp.
  async function handleCroppedSave(croppedFile: File) {
    const updatedUser = await uploadAvatar(croppedFile, user.full_name)
    setAvatarUrl(resolveAvatarUrl(updatedUser.avatar_url) ?? '')
    setAvatarMode('url')
    closeCropModal()
    setNotice('Ảnh đại diện đã được cập nhật.')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await updateProfile({
        fullName: fullName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      })
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
                <label htmlFor="account-avatar-file">Chọn ảnh (JPG, PNG hoặc WebP)</label>
                <input ref={fileInputRef} id="account-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFileChange(event.currentTarget.files?.[0])} />
                <p className={styles.helperText}>Tối đa 2 MB. Sau khi chọn, bạn có thể kéo và phóng to để căn chỉnh ảnh trước khi lưu.</p>
              </>
            )}
            <div className={styles.avatarPreview}>
              <UserAvatar source={displayedAvatar} username={user.username ?? user.email} size="large" label="Ảnh xem trước" />
              <span>Ảnh đại diện hiện tại hoặc ảnh mặc định.</span>
            </div>
          </fieldset>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.success} role="status">{notice}</p>}
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/profile">Hủy</Link>
            <button className={styles.primaryButton} type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
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
      {cropUrl && (
        <AvatarCropModal imageUrl={cropUrl} onCancel={closeCropModal} onSave={handleCroppedSave} />
      )}
    </section>
  )
}

export default AccountProfilePage