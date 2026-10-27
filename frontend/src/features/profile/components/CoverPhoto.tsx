import { useEffect, useRef, useState, type FormEvent } from 'react'
import CoverCropModal from './CoverCropModal'
import styles from './CoverPhoto.module.css'

type Props = { username: string; canEdit: boolean }

const MAX_FILE_BYTES = 5 * 1024 * 1024
const storageKey = (username: string) => `uth-profile-cover:${username.toLowerCase()}`

function readStored(username: string): string | null {
  try {
    return localStorage.getItem(storageKey(username))
  } catch {
    return null
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function CoverPhoto({ username, canEdit }: Props) {
  const [cover, setCover] = useState<string | null>(() => readStored(username))
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [failed, setFailed] = useState(false)
  const [crop, setCrop] = useState<{ url: string; remote: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCover(readStored(username))
    setFailed(false)
  }, [username])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function persist(value: string | null) {
    try {
      if (value) localStorage.setItem(storageKey(username), value)
      else localStorage.removeItem(storageKey(username))
    } catch {
      setError('Không thể lưu ảnh bìa (bộ nhớ trình duyệt đã đầy). Hãy chọn ảnh nhỏ hơn.')
      return false
    }
    setCover(value)
    setFailed(false)
    setError('')
    setOpen(false)
    return true
  }

  function closeCrop() {
    setCrop((current) => {
      if (current && !current.remote) URL.revokeObjectURL(current.url)
      return null
    })
  }

  function handleUrl(event: FormEvent) {
    event.preventDefault()
    const value = url.trim()
    if (!isHttpUrl(value)) {
      setError('Đường dẫn phải bắt đầu bằng http:// hoặc https://')
      return
    }
    setError('')
    setCrop({ url: value, remote: true })
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp ảnh.')
    } else if (file.size > MAX_FILE_BYTES) {
      setError('Ảnh tối đa 5 MB.')
    } else {
      setError('')
      setCrop({ url: URL.createObjectURL(file), remote: false })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function applyCrop(value: string) {
    closeCrop()
    if (persist(value)) setUrl('')
    else setOpen(true)
  }
  const showImage = cover && !failed

  return (
    <div className={styles.cover}>
      {showImage ? (
        <img className={styles.image} src={cover} alt="" onError={() => setFailed(true)} />
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}

      {canEdit && (
        <button
          type="button"
          className={styles.editButton}
          onClick={() => {
            setError('')
            setOpen((value) => !value)
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
            <circle cx="12" cy="13.5" r="3.5" />
          </svg>
          Chỉnh sửa ảnh bìa
        </button>
      )}

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Chỉnh sửa ảnh bìa">
          <div className={styles.modes}>
            <label>
              <input type="radio" name="cover-mode" checked={mode === 'url'} onChange={() => setMode('url')} />
              Dùng đường dẫn ảnh
            </label>
            <label>
              <input type="radio" name="cover-mode" checked={mode === 'upload'} onChange={() => setMode('upload')} />
              Tải ảnh từ thiết bị
            </label>
          </div>
          {mode === 'url' ? (
            <form className={styles.row} onSubmit={handleUrl}>
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/cover.jpg"
                aria-label="Đường dẫn ảnh bìa"
                maxLength={2048}
              />
              <button type="submit" className={styles.primary}>Áp dụng</button>
            </form>
          ) : (
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh bìa từ thiết bị"
              onChange={(event) => handleFile(event.currentTarget.files?.[0])}
            />
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.footer}>
            {cover && (
              <button type="button" className={styles.link} onClick={() => persist(null)}>
                Xóa ảnh bìa
              </button>
            )}
            <button type="button" className={styles.link} onClick={() => setOpen(false)}>Đóng</button>
          </div>
        </div>
      )}

      {crop && (
        <CoverCropModal
          imageUrl={crop.url}
          isRemote={crop.remote}
          onCancel={closeCrop}
          onSave={applyCrop}
          onUseOriginal={crop.remote ? () => applyCrop(crop.url) : undefined}
        />
      )}
    </div>
  )
}

export default CoverPhoto
