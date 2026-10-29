import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES } from '../avatar-constants'
import { constrainCropOffset, getCropImageStyle, getCropRect } from '../crop-geometry'
import styles from './AvatarCropModal.module.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const KEY_STEP = 0.02

type Size = { width: number; height: number }
type Offset = { x: number; y: number }

export type CropSelection = {
  x: number
  y: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  aspect: number
}

type AvatarCropModalProps = {
  imageUrl: string
  crossOrigin?: 'anonymous'
  onCancel: () => void
  onSave: (croppedFile: File, crop: CropSelection) => Promise<void>
  aspectRatio?: number
  outputWidth?: number
  maxBytes?: number
  fileBaseName?: string
  title?: string
  hint?: string
  saveLabel?: string
}

function AvatarCropModal({
  imageUrl,
  crossOrigin,
  onCancel,
  onSave,
  aspectRatio = 1,
  outputWidth = 512,
  maxBytes = AVATAR_MAX_BYTES,
  fileBaseName = 'avatar',
  title = 'Chỉnh sửa ảnh đại diện',
  hint = 'Kéo ảnh để đổi vị trí, dùng thanh trượt để phóng to hoặc thu nhỏ.',
  saveLabel = 'Lưu ảnh đại diện',
}: AvatarCropModalProps) {
  const [natural, setNatural] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const imageRef = useRef<HTMLImageElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const isCover = aspectRatio !== 1

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function constrain(next: Offset, nextZoom: number): Offset {
    if (!natural) return next
    return constrainCropOffset(natural, nextZoom, aspectRatio, next)
  }

  function handleZoom(value: number) {
    setZoom(value)
    setOffset((current) => constrain(current, value))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isSaving) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = dragRef.current
    const box = boxRef.current
    if (!previous || !box) return
    const dx = (event.clientX - previous.x) / box.clientWidth
    const dy = (event.clientY - previous.y) / box.clientHeight
    dragRef.current = { x: event.clientX, y: event.clientY }
    setOffset((current) => constrain({ x: current.x + dx, y: current.y + dy }, zoom))
  }

  function handleBoxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setOffset((current) => constrain({ x: current.x + move[0], y: current.y + move[1] }, zoom))
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isSaving) onCancel()
  }

  async function handleSave() {
    const image = imageRef.current
    if (!image || !natural) return
    setError('')
    setIsSaving(true)
    try {
      const crop = getCropRect(natural, zoom, aspectRatio, offset)
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = Math.round(outputWidth / aspectRatio)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
      if (!blob || !AVATAR_ACCEPTED_TYPES.includes(blob.type)) {
        throw new Error('Trình duyệt không thể xử lý ảnh này.')
      }
      if (blob.size > maxBytes) {
        throw new Error(`Ảnh sau khi cắt vượt quá ${(maxBytes / (1024 * 1024)).toFixed(0)} MB. Hãy chọn ảnh khác.`)
      }
      const selection: CropSelection = {
        ...crop,
        sourceWidth: natural.width,
        sourceHeight: natural.height,
        aspect: aspectRatio,
      }
      await onSave(new File([blob], `${fileBaseName}.webp`, { type: blob.type }), selection)
    } catch (saveError) {
      setError(
        saveError instanceof DOMException && saveError.name === 'SecurityError'
          ? 'Máy chủ ảnh không cho phép tải ảnh an toàn (CORS). Hãy dùng ảnh khác hoặc tải tệp từ thiết bị.'
          : saveError instanceof Error && saveError.message !== 'canvas'
            ? saveError.message
            : 'Không thể lưu ảnh. Vui lòng thử lại.',
      )
      setIsSaving(false)
    }
  }

  const transform = natural ? getCropImageStyle(natural, zoom, aspectRatio, offset) : undefined

  return (
    <div className={styles.backdrop}>
      <div
        className={`${styles.dialog} ${isCover ? styles.coverDialog : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="crop-dialog-title">{title}</h2>
        <p className={styles.hint}>{hint}</p>
        <div className={styles.workspace}>
          <div
            className={`${styles.cropBox} ${isCover ? styles.coverCropBox : ''}`}
            style={{ aspectRatio }}
            ref={boxRef}
            role="group"
            tabIndex={0}
            aria-label="Vùng cắt ảnh. Dùng phím mũi tên để di chuyển ảnh."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => { dragRef.current = null }}
            onPointerCancel={() => { dragRef.current = null }}
            onKeyDown={handleBoxKeyDown}
          >
            <img
              ref={imageRef}
              className={styles.image}
              crossOrigin={crossOrigin}
              src={imageUrl}
              alt=""
              draggable={false}
              style={transform}
              onLoad={(event) => setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
              onError={() => setError(
                crossOrigin
                  ? 'Không thể tải ảnh từ URL. Hãy kiểm tra địa chỉ và quyền CORS của máy chủ ảnh.'
                  : 'Không thể đọc ảnh. Hãy chọn tệp ảnh khác.',
              )}
            />
            <span className={`${styles.mask} ${isCover ? styles.coverMask : ''}`} aria-hidden="true" />
          </div>
          <div className={styles.side}>
            <div className={`${styles.preview} ${isCover ? styles.coverPreview : ''}`} style={{ aspectRatio }} aria-label="Xem trước ảnh đã cắt">
              {natural ? <img crossOrigin={crossOrigin} src={imageUrl} alt="" draggable={false} style={transform} /> : null}
            </div>
            <span className={styles.previewLabel}>Xem trước</span>
          </div>
        </div>
        <div className={styles.zoomRow}>
          <label htmlFor="image-crop-zoom">Thu phóng</label>
          <input
            id="image-crop-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!natural || isSaving}
            onChange={(event) => handleZoom(Number(event.target.value))}
          />
        </div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" onClick={onCancel} disabled={isSaving}>Hủy</button>
          <button className={styles.primary} type="button" onClick={handleSave} disabled={!natural || isSaving}>
            {isSaving ? 'Đang lưu…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvatarCropModal