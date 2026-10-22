import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, resolveAvatarUrl, type AuthUser } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { RequireAuth } from '../../auth/components/RequireAuth'
import UserAvatar from '../components/UserAvatar'
import styles from './ProfilePage.module.css'

type ProfilePageProps = {
  edit?: boolean
}

function ProfilePage({ edit = false }: ProfilePageProps) {
  const { user } = useAuth()

  return (
    <div className={styles.page}>
      <main className={styles.main} id="main-content">
        <RequireAuth>
          {user ? <ProfileContent user={user} edit={edit} /> : null}
        </RequireAuth>
      </main>
    </div>
  )
}

function ProfileContent({ user, edit }: { user: AuthUser; edit: boolean }) {
  const { updateProfile, uploadAvatar } = useAuth()
  const initialAvatarUrl = resolveAvatarUrl(user.avatar_url) ?? ''
  const initialFullName = user.full_name ?? ''
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filePreviewRef = useRef<string | null>(null)
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState(initialAvatarUrl)
  const [originalFullName, setOriginalFullName] = useState(initialFullName)
  const [fullName, setFullName] = useState(initialFullName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>('url')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState('')
  const [resetAvatar, setResetAvatar] = useState(false)
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const avatarChanged =
    resetAvatar ||
    (avatarMode === 'upload' && selectedFile !== null) ||
    avatarUrl.trim() !== originalAvatarUrl
  const profileChanged = fullName.trim() !== originalFullName || avatarChanged
  const avatarNeedsImageValidation =
    avatarChanged &&
    !resetAvatar &&
    ((avatarMode === 'upload' && selectedFile !== null) ||
      (avatarMode === 'url' && avatarUrl.trim() !== ''))
  const previewSource =
    avatarMode === 'upload'
      ? filePreviewUrl || null
      : avatarUrl.trim()
        ? resolveAvatarUrl(avatarUrl.trim())
        : null

  useEffect(() => {
    if (!previewSource) return
    const image = new Image()
    image.onload = () => setLoadedSource(previewSource)
    image.onerror = () => setFailedSource(previewSource)
    image.src = previewSource
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [previewSource])

  useEffect(() => () => {
    if (filePreviewRef.current) URL.revokeObjectURL(filePreviewRef.current)
  }, [])

  const previewStatus =
    !previewSource
      ? avatarMode === 'upload' && selectedFile
        ? 'loading'
        : avatarUrl.trim()
          ? 'invalid'
          : 'empty'
      : loadedSource === previewSource
        ? 'valid'
        : failedSource === previewSource
          ? 'invalid'
          : 'loading'

  function clearFilePreview() {
    if (filePreviewRef.current) URL.revokeObjectURL(filePreviewRef.current)
    filePreviewRef.current = null
    setFilePreviewUrl('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      let updatedUser: AuthUser
      const submittedFullName = fullName.trim() || null
      if (avatarMode === 'upload' && selectedFile) {
        updatedUser = await uploadAvatar(selectedFile, submittedFullName)
      } else {
        const update: { fullName?: string | null; avatarUrl?: string | null } = {}
        if (submittedFullName !== originalFullName) update.fullName = submittedFullName
        if (avatarChanged) update.avatarUrl = resetAvatar ? null : avatarUrl.trim() || null
        updatedUser = await updateProfile(update)
      }

      const savedFullName = updatedUser.full_name ?? ''
      const nextAvatarUrl = resolveAvatarUrl(updatedUser.avatar_url) ?? ''
      setOriginalFullName(savedFullName)
      setOriginalAvatarUrl(nextAvatarUrl)
      setFullName(savedFullName)
      setAvatarUrl(nextAvatarUrl)
      clearFilePreview()
      setSelectedFile(null)
      setResetAvatar(false)
      setAvatarMode('url')
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  function handleUrlChange(value: string) {
    setAvatarMode('url')
    clearFilePreview()
    setSelectedFile(null)
    setResetAvatar(false)
    setAvatarUrl(value)
    setError('')
    setNotice('')
  }

  function handleFileChange(file: File | undefined) {
    setError('')
    setNotice('')
    clearFilePreview()
    if (!file) {
      setSelectedFile(null)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setError('Ảnh đại diện phải có dung lượng tối đa 2 MB.')
      return
    }
    setAvatarMode('upload')
    setResetAvatar(false)
    const objectUrl = URL.createObjectURL(file)
    filePreviewRef.current = objectUrl
    setFilePreviewUrl(objectUrl)
    setSelectedFile(file)
  }

  return (
    <section className={styles.card} aria-labelledby="profile-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Tài khoản UTH Online Judge</p>
        <h1 id="profile-title">{edit ? 'Chỉnh sửa hồ sơ' : 'Thông tin cá nhân'}</h1>
        <p>Quản lý thông tin hồ sơ dùng trong cộng đồng học lập trình.</p>
      </div>

      <div className={styles.profileIdentity}>
        <UserAvatar
          source={resolveAvatarUrl(user.avatar_url)}
          username={user.username ?? user.email}
          size="large"
          label={`Ảnh đại diện của ${user.username ?? user.email}`}
        />
        <div>
          <strong>{user.full_name || user.username || user.email}</strong>
          <span>{user.username ? `@${user.username}` : user.email}</span>
        </div>
      </div>

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
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={100}
            autoComplete="name"
          />

          <fieldset className={styles.avatarFieldset}>
            <legend>Ảnh đại diện</legend>
            <div className={styles.avatarChoices}>
              <label>
                <input
                  type="radio"
                  name="avatarMode"
                  value="url"
                  checked={avatarMode === 'url'}
                  onChange={() => setAvatarMode('url')}
                />
                Dùng đường dẫn URL
              </label>
              <label>
                <input
                  type="radio"
                  name="avatarMode"
                  value="upload"
                  checked={avatarMode === 'upload'}
                  onChange={() => setAvatarMode('upload')}
                />
                Tải ảnh từ thiết bị
              </label>
            </div>
            {avatarMode === 'url' ? (
              <>
                <label htmlFor="profile-avatar-url">Đường dẫn ảnh (HTTP hoặc HTTPS)</label>
                <input
                  id="profile-avatar-url"
                  name="avatarUrl"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={avatarUrl}
                  onChange={(event) => handleUrlChange(event.target.value)}
                  maxLength={2048}
                  placeholder="https://example.com/avatar.png"
                  aria-describedby="avatar-url-help"
                />
                <p id="avatar-url-help" className={styles.helperText}>
                  Có thể dán liên kết ảnh công khai. Để trống ảnh hiện tại nếu chưa muốn đổi.
                </p>
              </>
            ) : (
              <>
                <label htmlFor="profile-avatar-file">Chọn ảnh (PNG, JPEG, WebP hoặc GIF)</label>
                <input
                  ref={fileInputRef}
                  id="profile-avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => handleFileChange(event.currentTarget.files?.[0])}
                  aria-describedby="avatar-file-help"
                />
                <p id="avatar-file-help" className={styles.helperText}>
                  Tối đa 2 MB. Định dạng ảnh sẽ được máy chủ xác minh trước khi lưu.
                </p>
              </>
            )}
            <div className={styles.avatarPreview} aria-live="polite">
              <UserAvatar
                source={previewStatus === 'invalid' ? null : previewSource}
                username={user.username ?? user.email}
                size="large"
                label="Ảnh xem trước"
              />
              <div className={styles.previewStatus}>
                <strong>Xem trước</strong>
                {previewStatus === 'loading' && <span>Đang tải ảnh xem trước…</span>}
                {previewStatus === 'valid' && <span>Ảnh sẵn sàng để lưu.</span>}
                {previewStatus === 'invalid' && (
                  <span className={styles.previewError}>
                    Không thể tải ảnh. Hãy kiểm tra URL hoặc chọn tệp ảnh khác.
                  </span>
                )}
                {previewStatus === 'empty' && <span>Avatar mặc định sẽ được sử dụng.</span>}
              </div>
            </div>
            <button
              className={styles.resetButton}
              type="button"
              onClick={() => {
                setAvatarMode('url')
                setAvatarUrl('')
                clearFilePreview()
                setSelectedFile(null)
                setResetAvatar(true)
                setError('')
                setNotice('')
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            >
              Khôi phục avatar mặc định
            </button>
          </fieldset>

          {error && <p className={styles.feedback} role="alert">{error}</p>}
          {notice && <p className={styles.success} role="status">{notice}</p>}
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} to="/profile">Hủy</Link>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={
                isSaving ||
                !profileChanged ||
                (avatarNeedsImageValidation && previewStatus !== 'valid') ||
                (avatarMode === 'upload' && !selectedFile)
              }
            >
              {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className={styles.details}>
            <div><dt>Tên đăng nhập</dt><dd>{user.username ?? 'Chưa thiết lập'}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Họ và tên</dt><dd>{user.full_name || 'Chưa cập nhật'}</dd></div>
            <div>
              <dt>Ngày tham gia</dt>
              <dd>{new Date(user.created_at).toLocaleDateString('vi-VN')}</dd>
            </div>
          </dl>
          <Link className={styles.primaryButton} to="/profile/edit">
            Chỉnh sửa hồ sơ
          </Link>
        </>
      )}
    </section>
  )
}

export default ProfilePage
