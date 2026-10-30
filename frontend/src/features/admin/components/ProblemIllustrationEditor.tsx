import { useState, type ChangeEvent } from 'react'
import { ApiError, resolveIllustrationUrl } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import type { ProblemDraft } from '../types'
import styles from './ProblemIllustrationEditor.module.css'

type IllustrationSettings = Pick<
  ProblemDraft,
  'illustrationUrl' | 'illustrationWidth' | 'illustrationAspectRatio' | 'illustrationAlignment'
>

const aspectRatios: IllustrationSettings['illustrationAspectRatio'][] = ['auto', '16:9', '4:3', '3:2', '1:1']

function isSafePreviewUrl(value: string): boolean {
  return Boolean(resolveIllustrationUrl(value))
}

function ProblemIllustrationEditor({
  settings,
  onChange,
  onUploadingChange,
}: {
  settings: IllustrationSettings
  onChange: (settings: Partial<IllustrationSettings>) => void
  onUploadingChange: (uploading: boolean) => void
}) {
  const { request } = useAdmin()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [imageFailed, setImageFailed] = useState(false)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const body = new FormData()
    body.append('image', file)
    setUploading(true)
    onUploadingChange(true)
    setError('')
    try {
      const result = await request<{ url: string }>('/admin/problems/illustrations', {
        method: 'POST',
        body,
      })
      setImageFailed(false)
      onChange({ illustrationUrl: result.url })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải ảnh lên. Vui lòng thử lại.')
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  const safeUrl = settings.illustrationUrl?.trim() ?? ''
  const canPreview = Boolean(safeUrl && isSafePreviewUrl(safeUrl) && !imageFailed)
  const imageSource = resolveIllustrationUrl(safeUrl)
  const aspectRatio = settings.illustrationAspectRatio === 'auto'
    ? undefined
    : settings.illustrationAspectRatio.replace(':', ' / ')

  return (
    <div className={styles.editor}>
      <div className={styles.sources}>
        <div className={styles.urlField}>
          <label htmlFor="illustration-url">URL hình ảnh</label>
          <input
            id="illustration-url"
            type="text"
            inputMode="url"
            maxLength={2048}
            value={settings.illustrationUrl ?? ''}
            placeholder="https://example.com/image.png"
            onChange={(event) => {
              setImageFailed(false)
              setError('')
              onChange({ illustrationUrl: event.target.value || null })
            }}
          />
          <p>Chỉ chấp nhận URL HTTP(S) hoặc ảnh tải lên hệ thống.</p>
        </div>
        <label className={styles.uploadButton}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(event) => void upload(event)}
          />
          {uploading ? 'Đang tải ảnh…' : 'Tải ảnh từ thiết bị'}
        </label>
        {settings.illustrationUrl && (
          <button
            className={styles.removeButton}
            type="button"
            onClick={() => {
              setImageFailed(false)
              onChange({ illustrationUrl: null })
            }}
          >
            Xóa ảnh
          </button>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {settings.illustrationUrl && !isSafePreviewUrl(safeUrl) && (
        <p className={styles.error} role="alert">URL chưa hợp lệ; vui lòng dùng đường dẫn HTTP(S).</p>
      )}
      {canPreview ? (
        <div className={`${styles.preview} ${styles[`align_${settings.illustrationAlignment}`]}`}>
          <img
            src={imageSource ?? undefined}
            alt="Xem trước hình ảnh minh họa"
            style={{ width: `${settings.illustrationWidth}%`, aspectRatio }}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : settings.illustrationUrl && imageFailed ? (
        <p className={styles.error} role="status">Không tải được ảnh xem trước. Hãy kiểm tra URL hoặc chọn ảnh khác.</p>
      ) : (
        <p className={styles.emptyPreview}>Chưa có hình ảnh minh họa.</p>
      )}

      <div className={styles.settings}>
        <div>
          <label htmlFor="illustration-width">Chiều rộng: {settings.illustrationWidth}%</label>
          <input
            id="illustration-width"
            type="range"
            min="25"
            max="100"
            step="5"
            value={settings.illustrationWidth}
            onChange={(event) => onChange({ illustrationWidth: Number(event.target.value) })}
          />
        </div>
        <div>
          <label htmlFor="illustration-aspect">Tỷ lệ khung hình</label>
          <select
            id="illustration-aspect"
            value={settings.illustrationAspectRatio}
            onChange={(event) => onChange({
              illustrationAspectRatio: event.target.value as IllustrationSettings['illustrationAspectRatio'],
            })}
          >
            {aspectRatios.map((ratio) => (
              <option key={ratio} value={ratio}>{ratio === 'auto' ? 'Tự động' : ratio}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="illustration-alignment">Căn lề</label>
          <select
            id="illustration-alignment"
            value={settings.illustrationAlignment}
            onChange={(event) => onChange({
              illustrationAlignment: event.target.value as IllustrationSettings['illustrationAlignment'],
            })}
          >
            <option value="left">Trái</option>
            <option value="center">Giữa</option>
            <option value="right">Phải</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default ProblemIllustrationEditor
