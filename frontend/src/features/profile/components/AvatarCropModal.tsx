import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
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
  title,
  hint,
  saveLabel,
}: AvatarCropModalProps) {
  const { t, i18n } = useTranslation('pages')
  const dialogTitle = title ?? t('cropImageTitle')
  const dialogHint = hint ?? t('cropImageHint')
  const dialogSaveLabel = saveLabel ?? t('saveAvatarImage')
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
        throw new Error(t('cropImageUnsupported'))
      }
      if (blob.size > maxBytes) {
        throw new Error(t('cropImageTooLarge', {
          size: new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN').format(maxBytes / (1024 * 1024)),
        }))
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
          ? t('cropImageCorsError')
          : saveError instanceof Error && saveError.message !== 'canvas'
            ? saveError.message
            : t('cropImageSaveError'),
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
        <h2 id="crop-dialog-title">{dialogTitle}</h2>
        <p className={styles.hint}>{dialogHint}</p>
        <div className={styles.workspace}>
          <div
            className={`${styles.cropBox} ${isCover ? styles.coverCropBox : ''}`}
            style={{ aspectRatio }}
            ref={boxRef}
            role="group"
            tabIndex={0}
            aria-label={t('cropImageArea')}
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
                  ? t('cropImageUrlLoadError')
                  : t('cropImageReadError'),
              )}
            />
            <span className={`${styles.mask} ${isCover ? styles.coverMask : ''}`} aria-hidden="true" />
          </div>
          <div className={styles.side}>
            <div className={`${styles.preview} ${isCover ? styles.coverPreview : ''}`} style={{ aspectRatio }} aria-label={t('cropImagePreview')}>
              {natural ? <img crossOrigin={crossOrigin} src={imageUrl} alt="" draggable={false} style={transform} /> : null}
            </div>
            <span className={styles.previewLabel}>{t('cropImagePreview')}</span>
          </div>
        </div>
        <div className={styles.zoomRow}>
          <label htmlFor="image-crop-zoom">{t('cropImageZoom')}</label>
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
          <button className={styles.secondary} type="button" onClick={onCancel} disabled={isSaving}>{t('cancel')}</button>
          <button className={styles.primary} type="button" onClick={handleSave} disabled={!natural || isSaving}>
            {isSaving ? t('saving') : dialogSaveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvatarCropModal