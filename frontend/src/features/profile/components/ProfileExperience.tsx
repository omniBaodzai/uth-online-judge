import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import AvatarCropModal, { type CropSelection } from './AvatarCropModal'
import ProfileShowcase from './ProfileShowcase'
import { AVATAR_ACCEPTED_TYPES, isSupportedAvatarUrl } from '../avatar-constants'
import type { AuthUser } from '../../auth/api'
import type { ProfileViewModel } from '../api'
import styles from '../pages/ProfilePage.module.css'

const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_ASPECT = 3.2

type ProfileExperienceProps = {
  profile: ProfileViewModel
  isOwner: boolean
  privateEmail?: string
  onUploadCover: (file: File, crop: CropSelection) => Promise<AuthUser>
  onRemoveCover?: (input: { coverImageUrl: null }) => Promise<AuthUser>
}

function ProfileExperience({
  profile: initialProfile,
  isOwner,
  privateEmail,
  onUploadCover,
  onRemoveCover,
}: ProfileExperienceProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [coverCropUrl, setCoverCropUrl] = useState('')
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [isRemovingCover, setIsRemovingCover] = useState(false)
  const [cropUsesRemoteUrl, setCropUsesRemoteUrl] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const coverInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const urlLoadCancelRef = useRef<(() => void) | null>(null)
  const urlLoadIdRef = useRef(0)

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function rememberObjectUrl(file: File): string {
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    return url
  }

  function revokeObjectUrl(url: string) {
    URL.revokeObjectURL(url)
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url)
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    chooseCoverFile(file)
  }

  function chooseCoverFile(file: File | undefined) {
    if (isLoadingUrl || isRemovingCover) return
    if (!file) return
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      setError('Ảnh bìa vượt quá 5 MB.')
      return
    }
    setError('')
    setNotice('')
    setCropUsesRemoteUrl(false)
    setCoverEditorOpen(false)
    setCoverCropUrl(rememberObjectUrl(file))
  }

  async function saveCover(file: File, crop: CropSelection): Promise<void> {
    try {
      const saved = await onUploadCover(file, crop)
      setProfile((current) => ({
        ...current,
        coverImageUrl: saved.cover_image_url,
        coverCrop: saved.cover_crop,
      }))
      if (coverCropUrl) revokeObjectUrl(coverCropUrl)
      setCoverCropUrl('')
      setCoverEditorOpen(false)
      setCropUsesRemoteUrl(false)
      setCoverUrl('')
      setNotice('Ảnh bìa đã được lưu.')
      setError('')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể lưu ảnh bìa. Vui lòng thử lại.')
      throw uploadError
    }
  }

  async function applyCoverUrl() {
    const url = coverUrl.trim()
    if (!isSupportedAvatarUrl(url)) {
      setError('Vui lòng nhập URL ảnh hợp lệ bắt đầu bằng http:// hoặc https://.')
      return
    }

    setError('')
    setNotice('')
    setIsLoadingUrl(true)
    const requestId = ++urlLoadIdRef.current
    let cancelled = false
    let timeout: number
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image()
        const cleanup = () => {
          window.clearTimeout(timeout)
          image.onload = null
          image.onerror = null
          if (urlLoadCancelRef.current === cancel) urlLoadCancelRef.current = null
        }
        const cancel = () => {
          cancelled = true
          cleanup()
          image.src = ''
          reject(new Error('cancelled'))
        }
        urlLoadCancelRef.current = cancel
        timeout = window.setTimeout(() => {
          cleanup()
          reject(new Error('timeout'))
        }, 20_000)
        const finish = (callback: () => void) => {
          cleanup()
          callback()
        }
        image.crossOrigin = 'anonymous'
        image.onload = () => finish(resolve)
        image.onerror = () => finish(() => reject(new Error('load')))
        image.src = url
      })
      if (requestId !== urlLoadIdRef.current) return
      setCropUsesRemoteUrl(true)
      setCoverCropUrl(url)
      setCoverEditorOpen(false)
    } catch {
      if (!cancelled) {
        setError('Không thể tải ảnh từ URL. Hãy kiểm tra địa chỉ, kết nối và quyền CORS của máy chủ ảnh.')
      }
    } finally {
      if (requestId === urlLoadIdRef.current) {
        urlLoadCancelRef.current = null
        setIsLoadingUrl(false)
      }
    }
  }

  function cancelUrlLoad() {
    urlLoadIdRef.current += 1
    urlLoadCancelRef.current?.()
    urlLoadCancelRef.current = null
    setIsLoadingUrl(false)
  }

  async function removeCover() {
    if (!onRemoveCover || !profile.coverImageUrl) return
    const confirmed = window.confirm('Bạn có chắc muốn xóa ảnh bìa khỏi hồ sơ?')
    if (!confirmed) return

    setError('')
    setNotice('')
    setIsRemovingCover(true)
    try {
      const saved = await onRemoveCover({ coverImageUrl: null })
      setProfile((current) => ({
        ...current,
        coverImageUrl: saved.cover_image_url,
        coverCrop: saved.cover_crop,
      }))
      setCoverEditorOpen(false)
      setNotice('Đã xóa ảnh bìa.')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Không thể xóa ảnh bìa. Vui lòng thử lại.')
    } finally {
      setIsRemovingCover(false)
    }
  }

  return (
    <div className={styles.profileContent}>
      <ProfileShowcase
        profile={profile}
        isOwner={isOwner}
        privateEmail={privateEmail}
        coverEditorOpen={coverEditorOpen}
        coverUrl={coverUrl}
        coverError={error}
        isCoverBusy={isLoadingUrl || isRemovingCover}
        onEditCover={() => {
          setError('')
          if (coverEditorOpen) cancelUrlLoad()
          setCoverEditorOpen((open) => !open)
        }}
        onCloseCoverEditor={() => {
          cancelUrlLoad()
          setCoverEditorOpen(false)
          setError('')
        }}
        onCoverUrlChange={setCoverUrl}
        onApplyCoverUrl={() => void applyCoverUrl()}
        onChooseCover={() => coverInputRef.current?.click()}
        onDropCover={chooseCoverFile}
        onRemoveCover={() => void removeCover()}
      />
      {notice ? <p className={styles.success} role="status">{notice}</p> : null}
      {error ? <p className={styles.feedback} role="alert">{error}</p> : null}
      {isOwner ? (
        <input
          ref={coverInputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={chooseCover}
        />
      ) : null}
      {coverCropUrl ? (
        <AvatarCropModal
          imageUrl={coverCropUrl}
          aspectRatio={COVER_ASPECT}
          outputWidth={1600}
          maxBytes={COVER_MAX_BYTES}
          fileBaseName="profile-cover"
          title="Chỉnh sửa ảnh bìa"
          hint="Kéo ảnh để căn banner, dùng thanh trượt để phóng to hoặc thu nhỏ."
          saveLabel="Dùng ảnh bìa"
          crossOrigin={cropUsesRemoteUrl ? 'anonymous' : undefined}
          onCancel={() => {
            if (coverCropUrl.startsWith('blob:')) revokeObjectUrl(coverCropUrl)
            setCoverCropUrl('')
            setCropUsesRemoteUrl(false)
          }}
          onSave={saveCover}
        />
      ) : null}
    </div>
  )
}

export default ProfileExperience
