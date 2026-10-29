import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { RequireAuth } from '../../auth/components/RequireAuth'
import { resolveAvatarUrl, type AuthUser } from '../../auth/api'
import AvatarCropModal from '../components/AvatarCropModal'
import UserAvatar from '../components/UserAvatar'
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES, isSupportedAvatarUrl } from '../avatar-constants'
import { toProfileViewModel } from '../api'
import type { ProfileViewModel } from '../api'
import { usePublicProfile } from '../usePublicProfile'
import styles from './ProfilePage.module.css'

type AvatarSourceTab = 'url' | 'upload'

function ProfileEditPage() {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const { profile: result, loading, error } = usePublicProfile(
    user ? { userId: user.id } : {},
  )
  const profile = useMemo(() => result ? toProfileViewModel(result) : null, [result])

  return (
    <RequireAuth>
      <main className={styles.main} id="main-content">
        {loading ? <p className={styles.status} aria-live="polite">Đang tải hồ sơ…</p> : null}
        {error ? <p className={styles.feedback} role="alert">{error}</p> : null}
        {profile && user ? (
          <ProfileEditForm
            key={profile.id}
            profile={profile}
            user={user}
            onSave={updateProfile}
            onUploadAvatar={uploadAvatar}
          />
        ) : null}
      </main>
    </RequireAuth>
  )
}

function ProfileEditForm({
  profile,
  user,
  onSave,
  onUploadAvatar,
}: {
  profile: ProfileViewModel
  user: AuthUser
  onSave: (input: {
    fullName?: string | null
    bio?: string | null
    organization?: string | null
  }) => Promise<AuthUser>
  onUploadAvatar: (file: File, fullName: string | null) => Promise<AuthUser>
}) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [organization, setOrganization] = useState(profile.organization)
  const [avatarUrl, setAvatarUrl] = useState(() => resolveAvatarUrl(profile.avatarUrl))
  const [avatarCropUrl, setAvatarCropUrl] = useState('')
  const [cropUsesRemoteUrl, setCropUsesRemoteUrl] = useState(false)
  const [stagedAvatar, setStagedAvatar] = useState<File | null>(null)
  const [avatarTab, setAvatarTab] = useState<AvatarSourceTab>('upload')
  const [sourceUrl, setSourceUrl] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!avatarCropUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(avatarCropUrl)
  }, [avatarCropUrl])

  useEffect(() => {
    if (!avatarUrl?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(avatarUrl)
  }, [avatarUrl])

  function chooseAvatar(file: File | undefined) {
    if (!file) return
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Ảnh đại diện vượt quá 2 MB.')
      return
    }
    setError('')
    setSuccess('')
    setCropUsesRemoteUrl(false)
    setAvatarCropUrl(URL.createObjectURL(file))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    chooseAvatar(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    chooseAvatar(event.dataTransfer.files[0])
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      avatarInputRef.current?.click()
    }
  }

  async function loadUrlForCropping() {
    const value = sourceUrl.trim()
    if (!isSupportedAvatarUrl(value)) {
      setError('Vui lòng nhập URL ảnh hợp lệ bắt đầu bằng http:// hoặc https://.')
      return
    }

    setError('')
    setSuccess('')
    setIsLoadingUrl(true)
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image()
        const timeout = window.setTimeout(() => {
          image.onload = null
          image.onerror = null
          reject(new Error('timeout'))
        }, 20_000)
        const finish = (callback: () => void) => {
          window.clearTimeout(timeout)
          image.onload = null
          image.onerror = null
          callback()
        }
        image.crossOrigin = 'anonymous'
        image.onload = () => finish(resolve)
        image.onerror = () => finish(() => reject(new Error('load')))
        image.src = value
      })
      setCropUsesRemoteUrl(true)
      setAvatarCropUrl(value)
    } catch {
      setError('Không thể tải ảnh từ URL. Hãy kiểm tra địa chỉ, kết nối và quyền CORS của máy chủ ảnh.')
    } finally {
      setIsLoadingUrl(false)
    }
  }

  async function stageCroppedAvatar(file: File): Promise<void> {
    setAvatarUrl(URL.createObjectURL(file))
    setStagedAvatar(file)
    setAvatarCropUrl('')
    setSuccess('Ảnh đã được cắt. Nhấn “Lưu thay đổi” để lưu vào tài khoản.')
    setError('')
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsSaving(true)
    try {
      await onSave({
        fullName: fullName.trim() || null,
        bio: bio.trim() || null,
        organization: organization.trim() || null,
      })
      if (stagedAvatar) {
        try {
          const savedUser = await onUploadAvatar(stagedAvatar, null)
          setAvatarUrl(resolveAvatarUrl(savedUser.avatar_url))
          setStagedAvatar(null)
        } catch (uploadError) {
          setError(
            `Thông tin hồ sơ đã được lưu, nhưng ảnh đại diện chưa được cập nhật. ${
              uploadError instanceof Error ? uploadError.message : 'Vui lòng thử lại.'
            }`,
          )
          return
        }
      }
      setSuccess('Đã lưu thay đổi hồ sơ thành công.')
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      navigate('/profile', { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={styles.editPage} aria-labelledby="profile-edit-title">
      <header className={styles.editHeading}>
        <p className={styles.eyebrow}>Cài đặt tài khoản</p>
        <h1 id="profile-edit-title">Chỉnh sửa hồ sơ</h1>
        <p>Cập nhật thông tin hiển thị công khai của bạn.</p>
      </header>

      <div className={styles.editLayout}>
        <aside className={styles.editSidebar} aria-label="Ảnh đại diện và tài khoản">
          <section className={styles.editCard}>
            <div className={styles.avatarIdentity}>
              <UserAvatar
                source={avatarUrl}
                username={profile.username}
                size="large"
                label={`Ảnh đại diện của ${profile.username}`}
              />
              <div>
                <h2>{profile.displayName || profile.username}</h2>
                <span>@{profile.username}</span>
              </div>
            </div>

            <fieldset className={styles.avatarPicker}>
              <legend>Ảnh đại diện</legend>
              <div className={styles.avatarTabs} role="tablist" aria-label="Cách chọn ảnh đại diện">
                <button
                  type="button"
                  role="tab"
                  aria-selected={avatarTab === 'upload'}
                  className={avatarTab === 'upload' ? styles.avatarTabActive : ''}
                  onClick={() => { setAvatarTab('upload'); setError('') }}
                >
                  Tải ảnh lên
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={avatarTab === 'url'}
                  className={avatarTab === 'url' ? styles.avatarTabActive : ''}
                  onClick={() => { setAvatarTab('url'); setError('') }}
                >
                  Dán URL
                </button>
              </div>

              {avatarTab === 'url' ? (
                <div className={styles.avatarTabPanel} role="tabpanel">
                  <label htmlFor="avatar-source-url">URL hình ảnh</label>
                  <input
                    id="avatar-source-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault()
                    }}
                  />
                  <p className={styles.avatarHint}>Máy chủ ảnh cần cho phép CORS để trình chỉnh sửa có thể xử lý ảnh an toàn.</p>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={isLoadingUrl || isSaving}
                    onClick={() => void loadUrlForCropping()}
                  >
                    {isLoadingUrl ? 'Đang tải ảnh…' : 'Tiếp tục'}
                  </button>
                </div>
              ) : (
                <div className={styles.avatarTabPanel} role="tabpanel">
                  <input
                    ref={avatarInputRef}
                    className={styles.hiddenInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                  />
                  <div
                    className={styles.avatarDropzone}
                    role="button"
                    tabIndex={0}
                    onClick={() => avatarInputRef.current?.click()}
                    onKeyDown={handleDropzoneKeyDown}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <span className={styles.uploadIcon} aria-hidden="true">↑</span>
                    <strong>Kéo ảnh vào đây hoặc chọn tệp</strong>
                    <span>JPG, PNG hoặc WebP · tối đa 2 MB</span>
                  </div>
                </div>
              )}
            </fieldset>

            {error ? <p className={styles.feedback} role="alert">{error}</p> : null}
            {success ? <p className={styles.success} role="status">{success}</p> : null}
          </section>

          <section className={styles.editCard} aria-labelledby="account-info-title">
            <h2 className={styles.accountInfoTitle} id="account-info-title">Thông tin tài khoản</h2>
            <dl className={styles.accountInfo}>
              <div><dt>Username</dt><dd>@{profile.username}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
            </dl>
            <p className={styles.avatarHint}>Username và email chỉ đọc, không thể chỉnh sửa tại đây.</p>
          </section>
        </aside>

        <section className={styles.editCard} aria-label="Thông tin hồ sơ">
          <header className={styles.formHeading}>
            <h2>Thông tin cá nhân</h2>
            <p>Các thông tin này sẽ xuất hiện trên hồ sơ công khai của bạn.</p>
          </header>
          <form className={styles.form} onSubmit={saveChanges}>
            <label htmlFor="profile-name">Tên hiển thị</label>
            <input
              id="profile-name"
              value={fullName}
              maxLength={100}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isSaving}
            />

            <label htmlFor="profile-organization">Trường / tổ chức</label>
            <input
              id="profile-organization"
              value={organization}
              maxLength={160}
              placeholder="Ví dụ: Đại học ..."
              onChange={(event) => setOrganization(event.target.value)}
              disabled={isSaving}
            />

            <label htmlFor="profile-bio">Giới thiệu bản thân</label>
            <textarea
              id="profile-bio"
              value={bio}
              maxLength={500}
              rows={7}
              placeholder="Chia sẻ đôi điều về bạn..."
              onChange={(event) => setBio(event.target.value)}
              disabled={isSaving}
            />
            <span className={styles.characterCount}>{bio.length}/500 ký tự</span>

            <div className={styles.actions}>
              <Link className={styles.secondaryButton} to="/profile">Hủy</Link>
              <button className={styles.primaryButton} type="submit" disabled={isSaving || isLoadingUrl}>
                {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {avatarCropUrl ? (
        <AvatarCropModal
          key={avatarCropUrl}
          imageUrl={avatarCropUrl}
          crossOrigin={cropUsesRemoteUrl ? 'anonymous' : undefined}
          title="Chỉnh sửa ảnh đại diện"
          hint="Kéo ảnh để đổi vị trí, dùng thanh trượt để phóng to hoặc thu nhỏ. Ảnh sẽ được cắt thành hình vuông và hiển thị dạng tròn."
          saveLabel="Dùng ảnh này"
          onCancel={() => setAvatarCropUrl('')}
          onSave={stageCroppedAvatar}
        />
      ) : null}
    </section>
  )
}

export default ProfileEditPage
