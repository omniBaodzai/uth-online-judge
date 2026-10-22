import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import styles from './AvatarCropModal.module.css'
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES } from '../avatar-constants'

const OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const KEY_STEP = 0.02

type AvatarCropModalProps = {
  imageUrl: string
  onCancel: () => void
  onSave: (croppedFile: File) => Promise<void>
}

type Size = { width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Mọi vị trí được chuẩn hóa theo cạnh của khung cắt nên không phụ thuộc kích thước hiển thị.
function maxOffset(natural: Size, zoom: number) {
  const ratioX = (natural.width / Math.min(natural.width, natural.height)) * zoom
  const ratioY = (natural.height / Math.min(natural.width, natural.height)) * zoom
  return { x: (ratioX - 1) / 2, y: (ratioY - 1) / 2 }
}

function imageStyle(natural: Size, zoom: number, offset: { x: number; y: number }) {
  const shortSide = Math.min(natural.width, natural.height)
  return {
    width: `${(natural.width / shortSide) * zoom * 100}%`,
    height: `${(natural.height / shortSide) * zoom * 100}%`,
    left: `${(0.5 + offset.x) * 100}%`,
    top: `${(0.5 + offset.y) * 100}%`,
  }
}

function AvatarCropModal({ imageUrl, onCancel, onSave }: AvatarCropModalProps) {
  const [natural, setNatural] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const imageRef = useRef<HTMLImageElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function constrain(next: { x: number; y: number }, nextZoom: number) {
    if (!natural) return next
    const limit = maxOffset(natural, nextZoom)
    return { x: clamp(next.x, -limit.x, limit.x), y: clamp(next.y, -limit.y, limit.y) }
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
    const start = dragRef.current
    const box = boxRef.current
    if (!start || !box) return
    const size = box.clientWidth
    const dx = (event.clientX - start.x) / size
    const dy = (event.clientY - start.y) / size
    dragRef.current = { x: event.clientX, y: event.clientY }
    setOffset((current) => constrain({ x: current.x + dx, y: current.y + dy }, zoom))
  }

  function handlePointerEnd() {
    dragRef.current = null
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
      const sourceSize = Math.min(natural.width, natural.height) / zoom
      const centerX = natural.width / 2 - offset.x * sourceSize
      const centerY = natural.height / 2 - offset.y * sourceSize
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas')
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        image,
        centerX - sourceSize / 2,
        centerY - sourceSize / 2,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      )
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.9),
      )
      if (!blob || !AVATAR_ACCEPTED_TYPES.includes(blob.type)) {
        throw new Error('Trình duyệt không thể xử lý ảnh này.')
      }
      if (blob.size > AVATAR_MAX_BYTES) {
        throw new Error('Ảnh sau khi cắt vượt quá 2 MB. Hãy chọn ảnh khác.')
      }
      const extension = blob.type === 'image/webp' ? 'webp' : 'png'
      await onSave(new File([blob], `avatar.${extension}`, { type: blob.type }))
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message !== 'canvas'
          ? saveError.message
          : 'Không thể lưu ảnh đại diện. Vui lòng thử lại.',
      )
      setIsSaving(false)
    }
  }

  const transform = natural ? imageStyle(natural, zoom, offset) : undefined

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="avatar-crop-title">Chỉnh sửa ảnh đại diện</h2>
        <p className={styles.hint}>Kéo ảnh để đổi vị trí, dùng thanh trượt để phóng to hoặc thu nhỏ.</p>

        <div className={styles.workspace}>
          <div
            className={styles.cropBox}
            ref={boxRef}
            role="group"
            tabIndex={0}
            aria-label="Vùng cắt ảnh. Dùng phím mũi tên để di chuyển ảnh."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleBoxKeyDown}
          >
            {imageUrl && (
              <img
                ref={imageRef}
                className={styles.image}
                src={imageUrl}
                alt=""
                draggable={false}
                style={transform}
                onLoad={(event) =>
                  setNatural({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                onError={() => setError('Không thể đọc ảnh. Hãy chọn tệp ảnh khác.')}
              />
            )}
            <span className={styles.mask} aria-hidden="true" />
          </div>

          <div className={styles.side}>
            <div className={styles.preview} aria-label="Xem trước avatar">
              {imageUrl && natural && (
                <img src={imageUrl} alt="" draggable={false} style={transform} />
              )}
            </div>
            <span className={styles.previewLabel}>Xem trước</span>
          </div>
        </div>

        <div className={styles.zoomRow}>
          <label htmlFor="avatar-zoom">Thu phóng</label>
          <input
            id="avatar-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!natural || isSaving}
            onChange={(event) => handleZoom(Number(event.target.value))}
          />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button className={styles.secondary} type="button" onClick={onCancel} disabled={isSaving}>
            Hủy
          </button>
          <button
            className={styles.primary}
            type="button"
            onClick={handleSave}
            disabled={!natural || isSaving}
          >
            {isSaving ? 'Đang lưu…' : 'Lưu ảnh đại diện'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvatarCropModal
