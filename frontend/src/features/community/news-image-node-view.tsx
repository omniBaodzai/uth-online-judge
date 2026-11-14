import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight, ImagePlus, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { uploadNewsImage } from './news-media-upload'
import styles from './NewsImageNodeView.module.css'

const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function NewsImageNodeView({
  node,
  selected,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const { request, requestBlob } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const altInput = useRef<HTMLInputElement>(null)
  const [loadedImage, setLoadedImage] = useState<{ id: string; source?: string; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const source = node.attrs.src
  const match = typeof source === 'string' ? /^\/news\/media\/([^/]+)$/.exec(source) : null
  const mediaId = match && MEDIA_ID_PATTERN.test(match[1]) ? match[1] : ''
  const imageSource = loadedImage?.id === mediaId ? loadedImage.source : undefined
  const error = !mediaId
    ? 'Đường dẫn ảnh không hợp lệ.'
    : loadedImage?.id === mediaId
      ? loadedImage.error
      : undefined

  useEffect(() => {
    if (!mediaId) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    void requestBlob(`/admin/news/media/${mediaId}`, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setLoadedImage({ id: mediaId, source: objectUrl })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLoadedImage({
          id: mediaId,
          error: cause instanceof Error ? cause.message : 'Không thể tải ảnh xem trước.',
        })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, requestBlob])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setUploadError('')
    try {
      const uploaded = await uploadNewsImage(file, request)
      updateAttributes({ src: uploaded.url })
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const alignment = node.attrs.align === 'left' || node.attrs.align === 'right'
    ? node.attrs.align
    : 'center'
  const width = Number.isInteger(node.attrs.width) ? Number(node.attrs.width) : 100
  const isEditable = editor.isEditable

  return (
    <NodeViewWrapper
      as="figure"
      className={`${styles.figure} ${styles[`align${alignment[0].toUpperCase()}${alignment.slice(1)}`]}`}
      data-news-image="true"
      contentEditable={false}
      onClick={() => {
        const position = getPos()
        if (isEditable && typeof position === 'number') editor.commands.setNodeSelection(position)
      }}
    >
      <img
        className={selected && isEditable ? styles.selectedImage : styles.image}
        src={imageSource || undefined}
        alt={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''}
        title={typeof node.attrs.title === 'string' ? node.attrs.title : undefined}
        style={{ width: `${width}%` }}
        draggable={false}
      />
      {(error || uploadError) && <span className={styles.error} role="status">{uploadError || error}</span>}
      {selected && isEditable && (
        <div className={styles.controls} contentEditable={false} aria-label="Điều chỉnh ảnh">
          <label className={styles.altControl}>
            <span>Văn bản thay thế</span>
            <input
              ref={altInput}
              aria-label="Văn bản thay thế ảnh"
              key={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''}
              defaultValue={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''}
              maxLength={500}
              onBlur={() => {
                const next = altInput.current?.value.trim()
                if (next) updateAttributes({ alt: next })
                else if (altInput.current) {
                  altInput.current.value = typeof node.attrs.alt === 'string' ? node.attrs.alt : 'Ảnh tin tức'
                }
              }}
            />
          </label>
          <label className={styles.widthControl}>
            <span>Kích thước {width}%</span>
            <input
              type="range"
              min="25"
              max="100"
              step="1"
              value={width}
              aria-label="Chiều rộng ảnh theo phần trăm"
              onChange={(event) => updateAttributes({ width: Number(event.target.value) })}
            />
          </label>
          <div className={styles.actions} role="group" aria-label="Căn chỉnh ảnh">
            <button type="button" aria-label="Căn ảnh trái" aria-pressed={alignment === 'left'} onClick={() => updateAttributes({ align: 'left' })}>
              <AlignLeft aria-hidden="true" />
            </button>
            <button type="button" aria-label="Căn ảnh giữa" aria-pressed={alignment === 'center'} onClick={() => updateAttributes({ align: 'center' })}>
              <AlignCenter aria-hidden="true" />
            </button>
            <button type="button" aria-label="Căn ảnh phải" aria-pressed={alignment === 'right'} onClick={() => updateAttributes({ align: 'right' })}>
              <AlignRight aria-hidden="true" />
            </button>
            <button type="button" aria-label="Thay thế ảnh" disabled={busy} onClick={() => fileInput.current?.click()}>
              <ImagePlus aria-hidden="true" />
            </button>
            <button type="button" aria-label="Xóa ảnh khỏi bài viết" onClick={deleteNode}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <input
            ref={fileInput}
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Chọn ảnh thay thế"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}
