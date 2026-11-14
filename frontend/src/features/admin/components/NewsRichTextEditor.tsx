import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import { useAuth } from '../../auth/useAuth'
import {
  createEmptyNewsRichDocument,
  createNewsRichDocument,
  isSafeNewsLink,
  NEWS_RICH_TEXT_EXTENSIONS,
  type NewsRichDocument,
} from '../../community/news-rich-content'
import { NEWS_MEDIA_MAX_BYTES, uploadNewsImage } from '../../community/news-media-upload'
import styles from './NewsRichTextEditor.module.css'

type Props = {
  initialValue?: NewsRichDocument | null
  onChange: (value: NewsRichDocument) => void
}

const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']

function preventEditorBlur(event: ReactMouseEvent<HTMLButtonElement>) {
  event.preventDefault()
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function NewsRichTextEditor({ initialValue, onChange }: Props) {
  const [initialDocument] = useState(
    () => initialValue?.document ?? createEmptyNewsRichDocument().document,
  )
  const [preview, setPreview] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [, setSelectionVersion] = useState(0)
  const onChangeRef = useRef(onChange)
  const lastEmittedDocument = useRef<string | null>(null)
  const mediaInput = useRef<HTMLInputElement>(null)
  const { request } = useAuth()
  const requestRef = useRef(request)
  const insertImageRef = useRef<(file: File, position: number) => void>(() => undefined)
  const editorEditableRef = useRef(true)

  useEffect(() => {
    requestRef.current = request
  }, [request])

  const editor = useEditor({
    extensions: NEWS_RICH_TEXT_EXTENSIONS,
    content: initialDocument,
    editorProps: {
      attributes: { id: 'news-rich-content', 'aria-label': 'Nội dung tin tức Rich Text' },
      handleDrop: (view, event, _slice, moved) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith('image/'))
        if (moved || !file || !editorEditableRef.current) return false
        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          ?? view.state.selection.from
        insertImageRef.current(file, position)
        return true
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      lastEmittedDocument.current = stableJson(createNewsRichDocument(currentEditor.getJSON()))
    },
    onUpdate: ({ editor: currentEditor }) => {
      const document = createNewsRichDocument(currentEditor.getJSON())
      const serialized = stableJson(document)
      if (lastEmittedDocument.current === null) {
        lastEmittedDocument.current = serialized
        return
      }
      if (lastEmittedDocument.current === serialized) return
      lastEmittedDocument.current = serialized
      onChangeRef.current(document)
    },
    onTransaction: () => setSelectionVersion((version) => version + 1),
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    insertImageRef.current = (file, position) => {
      setMediaError('')
      setMediaBusy(true)
      void uploadNewsImage(file, requestRef.current)
        .then((media) => {
          if (!editor) return
          editor.chain().focus().insertContentAt(position, {
            type: 'image',
            attrs: { src: media.url, alt: 'Ảnh tin tức', width: 100, align: 'center' },
          }).run()
        })
        .catch((cause: unknown) => {
          setMediaError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên.')
        })
        .finally(() => setMediaBusy(false))
    }
  }, [editor])

  useEffect(() => {
    editor?.setEditable(!preview)
    editorEditableRef.current = !preview
  }, [editor, preview])

  if (!editor) return <div className={styles.loading} aria-live="polite">Đang mở trình soạn thảo…</div>

  const headingLevel = [2, 3, 4, 5, 6].find((level) => editor.isActive('heading', { level }))
  const currentFontSize = editor.getAttributes('textStyle').fontSize
  const currentColor = editor.getAttributes('textStyle').color
  const currentLink = editor.getAttributes('link').href
  const fontSizeIndex = fontSizes.indexOf(typeof currentFontSize === 'string' ? currentFontSize : '16px')
  const interactive = !preview

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const href = linkUrl.trim()
    if (!isSafeNewsLink(href)) {
      setLinkError('Nhập liên kết bắt đầu bằng http://, https:// hoặc mailto: hợp lệ.')
      return
    }

    editor.chain().focus().setLink({
      href,
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }).run()
    setLinkError('')
    setLinkOpen(false)
  }

  function changeFontSize(direction: -1 | 1) {
    const nextSize = fontSizes[Math.max(0, Math.min(fontSizes.length - 1, fontSizeIndex + direction))]
    if (nextSize) editor.chain().focus().setFontSize(nextSize).run()
  }

  return (
    <section className={styles.editor} aria-label="Trình soạn thảo Rich Text">
      <div className={styles.toolbar} role="toolbar" aria-label="Định dạng nội dung Rich Text">
        <div className={styles.group} role="group" aria-label="Kiểu đoạn">
          <label className={styles.visuallyHidden} htmlFor="news-rich-heading">Kiểu đoạn</label>
          <select
            id="news-rich-heading"
            aria-label="Kiểu đoạn"
            value={headingLevel ? String(headingLevel) : 'paragraph'}
            disabled={!interactive}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'paragraph') editor.chain().focus().setParagraph().run()
              else editor.chain().focus().setHeading({ level: Number(value) as 2 | 3 | 4 | 5 | 6 }).run()
            }}
          >
            <option value="paragraph">Đoạn văn</option>
            {[2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>Tiêu đề H{level}</option>)}
          </select>
          <label className={styles.visuallyHidden} htmlFor="news-rich-font-size">Cỡ chữ</label>
          <select
            id="news-rich-font-size"
            aria-label="Cỡ chữ"
            value={typeof currentFontSize === 'string' ? currentFontSize : ''}
            disabled={!interactive}
            onChange={(event) => {
              const value = event.target.value
              if (value) editor.chain().focus().setFontSize(value).run()
              else editor.chain().focus().unsetFontSize().run()
            }}
          >
            <option value="">Cỡ chữ</option>
            {fontSizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button type="button" className={styles.button} aria-label="Giảm cỡ chữ" disabled={!interactive || fontSizeIndex === 0} onMouseDown={preventEditorBlur} onClick={() => changeFontSize(-1)}><Minus aria-hidden="true" /></button>
          <button type="button" className={styles.button} aria-label="Tăng cỡ chữ" disabled={!interactive || fontSizeIndex === fontSizes.length - 1} onMouseDown={preventEditorBlur} onClick={() => changeFontSize(1)}><Plus aria-hidden="true" /></button>
        </div>

        <div className={styles.group} role="group" aria-label="Định dạng chữ">
          <button type="button" className={editor.isActive('bold') ? styles.activeButton : styles.button} aria-label="In đậm" aria-pressed={editor.isActive('bold')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden="true" /></button>
          <button type="button" className={editor.isActive('italic') ? styles.activeButton : styles.button} aria-label="In nghiêng" aria-pressed={editor.isActive('italic')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden="true" /></button>
          <button type="button" className={editor.isActive('underline') ? styles.activeButton : styles.button} aria-label="Gạch chân" aria-pressed={editor.isActive('underline')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline aria-hidden="true" /></button>
          <button type="button" className={editor.isActive('strike') ? styles.activeButton : styles.button} aria-label="Gạch ngang" aria-pressed={editor.isActive('strike')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough aria-hidden="true" /></button>
        </div>

        <div className={styles.group} role="group" aria-label="Màu chữ và tô sáng">
          <label className={styles.colorControl}>
            <span>Màu chữ</span>
            <input
              type="color"
              aria-label="Màu chữ"
              value={typeof currentColor === 'string' ? currentColor : '#193437'}
              disabled={!interactive}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            />
          </label>
          <button type="button" className={editor.isActive('highlight') ? styles.activeButton : styles.button} aria-label="Tô sáng văn bản" aria-pressed={editor.isActive('highlight')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fff29a' }).run()}><Highlighter aria-hidden="true" /></button>
        </div>

        <div className={styles.group} role="group" aria-label="Căn lề">
          <button type="button" className={editor.isActive({ textAlign: 'left' }) ? styles.activeButton : styles.button} aria-label="Căn trái" aria-pressed={editor.isActive({ textAlign: 'left' })} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft aria-hidden="true" /></button>
          <button type="button" className={editor.isActive({ textAlign: 'center' }) ? styles.activeButton : styles.button} aria-label="Căn giữa" aria-pressed={editor.isActive({ textAlign: 'center' })} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter aria-hidden="true" /></button>
          <button type="button" className={editor.isActive({ textAlign: 'right' }) ? styles.activeButton : styles.button} aria-label="Căn phải" aria-pressed={editor.isActive({ textAlign: 'right' })} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight aria-hidden="true" /></button>
          <button type="button" className={editor.isActive({ textAlign: 'justify' }) ? styles.activeButton : styles.button} aria-label="Căn đều" aria-pressed={editor.isActive({ textAlign: 'justify' })} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify aria-hidden="true" /></button>
        </div>

        <div className={styles.group} role="group" aria-label="Danh sách và trích dẫn">
          <button type="button" className={editor.isActive('bulletList') ? styles.activeButton : styles.button} aria-label="Danh sách dấu đầu dòng" aria-pressed={editor.isActive('bulletList')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBulletList().run()}><List aria-hidden="true" /></button>
          <button type="button" className={editor.isActive('orderedList') ? styles.activeButton : styles.button} aria-label="Danh sách đánh số" aria-pressed={editor.isActive('orderedList')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered aria-hidden="true" /></button>
          <button type="button" className={editor.isActive('blockquote') ? styles.activeButton : styles.button} aria-label="Trích dẫn" aria-pressed={editor.isActive('blockquote')} disabled={!interactive} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote aria-hidden="true" /></button>
        </div>

        <div className={styles.group} role="group" aria-label="Liên kết và ảnh">
          <button
            type="button"
            className={editor.isActive('link') ? styles.activeButton : styles.button}
            aria-label="Chèn hoặc sửa liên kết"
            aria-expanded={linkOpen}
            disabled={!interactive}
            onMouseDown={preventEditorBlur}
            onClick={() => {
              setLinkUrl(typeof currentLink === 'string' ? currentLink : '')
              setLinkError('')
              setLinkOpen((open) => !open)
            }}
          ><Link2 aria-hidden="true" /></button>
          <button
            type="button"
            className={styles.button}
            aria-label="Chèn ảnh từ thiết bị"
            title="Chèn ảnh từ thiết bị"
            disabled={!interactive || mediaBusy}
            onMouseDown={preventEditorBlur}
            onClick={() => mediaInput.current?.click()}
          ><ImagePlus aria-hidden="true" /></button>
          <input
            ref={mediaInput}
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Chọn ảnh tin tức"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file && file.size > NEWS_MEDIA_MAX_BYTES) {
                setMediaError('Ảnh phải có dung lượng tối đa 5 MiB.')
              } else if (file) {
                insertImageRef.current(file, editor.state.selection.from)
              }
              event.target.value = ''
            }}
          />
        </div>

        {mediaBusy && <p className={styles.mediaStatus} role="status">Đang tải và xử lý ảnh…</p>}
        {mediaError && <p className={styles.mediaError} role="alert">{mediaError}</p>}

        <div className={`${styles.group} ${styles.historyGroup}`} role="group" aria-label="Lịch sử chỉnh sửa">
          <button type="button" className={styles.button} aria-label="Hoàn tác" disabled={!interactive || !editor.can().undo()} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().undo().run()}><Undo2 aria-hidden="true" /></button>
          <button type="button" className={styles.button} aria-label="Làm lại" disabled={!interactive || !editor.can().redo()} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().redo().run()}><Redo2 aria-hidden="true" /></button>
        </div>
      </div>

      {linkOpen && (
        <form className={styles.linkForm} onSubmit={applyLink}>
          <label htmlFor="news-rich-link">Địa chỉ liên kết</label>
          <input id="news-rich-link" type="text" inputMode="url" value={linkUrl} autoComplete="url" onChange={(event) => setLinkUrl(event.target.value)} />
          <button type="submit" className={styles.linkSubmit}>Áp dụng</button>
          {editor.isActive('link') && (
            <button type="button" className={styles.linkRemove} aria-label="Xóa liên kết" onClick={() => {
              editor.chain().focus().unsetLink().run()
              setLinkOpen(false)
            }}><X aria-hidden="true" /></button>
          )}
          {linkError && <p className={styles.linkError} role="alert">{linkError}</p>}
        </form>
      )}

      <div className={styles.editorHeading}>
        <span>{preview ? 'Xem trước Rich Text' : 'Nội dung bài viết'}</span>
        <button type="button" className={preview ? styles.previewActive : styles.previewButton} aria-pressed={preview} onClick={() => setPreview((current) => !current)}>
          {preview ? 'Tiếp tục chỉnh sửa' : 'Xem trước'}
        </button>
      </div>
      <div className={preview ? styles.previewSurface : styles.surface}>
        <EditorContent editor={editor} />
      </div>
    </section>
  )
}

export default NewsRichTextEditor
