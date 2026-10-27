import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import styles from './CoverCropModal.module.css'

export const COVER_ASPECT = 5
const OUTPUT_WIDTH = 1600
const OUTPUT_HEIGHT = OUTPUT_WIDTH / COVER_ASPECT
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const KEY_STEP = 20

type Props = {
  imageUrl: string
  // Ảnh từ đường dẫn ngoài có thể bị chặn CORS nên không cắt được bằng canvas.
  isRemote: boolean
  onCancel: () => void
  onSave: (dataUrl: string) => void
  onUseOriginal?: () => void
}

type Natural = { width: number; height: number }
type Point = { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function CoverCropModal({ imageUrl, isRemote, onCancel, onSave, onUseOriginal }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const [natural, setNatural] = useState<Natural | null>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const [canvasBlocked, setCanvasBlocked] = useState(false)

  const frameHeight = frameWidth / COVER_ASPECT
  const baseScale = natural && frameWidth ? Math.max(frameWidth / natural.width, frameHeight / natural.height) : 1
  const scale = baseScale * zoom

  const limit = useCallback(
    (point: Point, nextScale: number): Point => {
      if (!natural) return point
      const maxX = Math.max(0, (natural.width * nextScale - frameWidth) / 2)
      const maxY = Math.max(0, (natural.height * nextScale - frameWidth / COVER_ASPECT) / 2)
      return { x: clamp(point.x, -maxX, maxX), y: clamp(point.y, -maxY, maxY) }
    },
    [natural, frameWidth],
  )

  useEffect(() => {
    const image = new Image()
    if (isRemote) image.crossOrigin = 'anonymous'
    image.onload = () => {
      imageRef.current = image
      setNatural({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      if (isRemote) setCanvasBlocked(true)
      setError(
        isRemote
          ? 'Không thể tải ảnh để chỉnh sửa (máy chủ ảnh không cho phép hoặc đường dẫn sai).'
          : 'Không thể đọc tệp ảnh.',
      )
    }
    image.src = imageUrl
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [imageUrl, isRemote])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setFrameWidth(frame.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [natural])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  const changeZoom = useCallback(
    (next: number) => {
      const value = clamp(next, MIN_ZOOM, MAX_ZOOM)
      setZoom(value)
      setOffset((current) => limit(current, baseScale * value))
    },
    [limit, baseScale],
  )

  // Con lăn chuột cần listener không-passive để chặn cuộn trang.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      changeZoom(zoom - event.deltaY * 0.0015)
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [changeZoom, zoom, natural])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offset,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    setOffset(
      limit(
        { x: state.origin.x + event.clientX - state.start.x, y: state.origin.y + event.clientY - state.start.y },
        scale,
      ),
    )
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, Point> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setOffset((current) => limit({ x: current.x + move.x, y: current.y + move.y }, scale))
    } else if (event.key === '+' || event.key === '=') changeZoom(zoom + 0.1)
    else if (event.key === '-') changeZoom(zoom - 0.1)
  }

  function save() {
    const image = imageRef.current
    if (!image || !natural || !frameWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return
    const sourceWidth = frameWidth / scale
    const sourceHeight = frameHeight / scale
    const sourceX = natural.width / 2 - offset.x / scale - sourceWidth / 2
    const sourceY = natural.height / 2 - offset.y / scale - sourceHeight / 2
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
    try {
      onSave(canvas.toDataURL('image/jpeg', 0.85))
    } catch {
      setCanvasBlocked(true)
      setError('Máy chủ của ảnh không cho phép cắt ảnh. Hãy tải ảnh về máy rồi chọn "Tải ảnh từ thiết bị".')
    }
  }

  const ready = natural !== null && frameWidth > 0

  return (
    <div className={styles.backdrop} onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="cover-crop-title">
        <h2 id="cover-crop-title">Chỉnh sửa ảnh bìa</h2>
        <p className={styles.hint}>Kéo ảnh để đổi vị trí, dùng thanh trượt hoặc con lăn chuột để phóng to / thu nhỏ.</p>

        {error ? (
          <p className={styles.error} role="alert">{error}</p>
        ) : (
          <div
            ref={frameRef}
            className={styles.frame}
            style={{ aspectRatio: `${COVER_ASPECT} / 1` }}
            tabIndex={0}
            role="group"
            aria-label="Khung căn chỉnh ảnh bìa. Dùng phím mũi tên để di chuyển, phím + và - để thu phóng."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          >
            {!natural && <span className={styles.loading} role="status">Đang tải ảnh…</span>}
            {ready && (
              <img
                className={styles.image}
                src={imageUrl}
                alt=""
                draggable={false}
                crossOrigin={isRemote ? 'anonymous' : undefined}
                style={{
                  width: natural.width * scale,
                  height: natural.height * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
          </div>
        )}

        {!error && (
          <div className={styles.zoomRow}>
            <label htmlFor="cover-zoom">Thu phóng</label>
            <input
              id="cover-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!ready}
              onChange={(event) => changeZoom(Number(event.target.value))}
            />
            <output>{Math.round(zoom * 100)}%</output>
          </div>
        )}

        <div className={styles.actions}>
          {canvasBlocked && onUseOriginal && (
            <button type="button" className={styles.secondary} onClick={onUseOriginal}>
              Dùng ảnh gốc (không cắt)
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={onCancel}>Hủy</button>
          <button type="button" className={styles.primary} onClick={save} disabled={!ready || Boolean(error)}>
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  )
}

export default CoverCropModal
