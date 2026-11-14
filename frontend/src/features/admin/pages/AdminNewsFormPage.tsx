import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from '../../../components/ui/Markdown'
import { ApiError } from '../../auth/api'
import type { NewsArticle } from '../../community/api'
import {
  buildNewsCreatePayload,
  buildNewsPatchPayload,
} from '../../community/news-form-payload'
import {
  createEmptyNewsRichDocument,
  getNewsRichDocumentIssue,
  hasNewsRichContent,
  NEWS_RICH_DOCUMENT_ISSUE_MESSAGES,
  type NewsRichDocument,
} from '../../community/news-rich-content'
import { validateNews, type NewsDraft as Draft, type NewsErrors as Errors } from '../../community/validation'
import { useAdmin } from '../useAdmin'
import styles from '../admin.module.css'

const emptyDraft: Draft = { title: '', slug: '', category: 'Thông báo', summary: '', content: '' }
const NewsRichTextEditor = lazy(() => import('../components/NewsRichTextEditor'))
type EditorMode = 'markdown' | 'rich'

function richSaveError(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error ? cause.message : 'Không thể lưu bài viết. Vui lòng thử lại.'
  }
  if (cause.status === 404) {
    return 'API Rich Text không khả dụng hoặc bài viết không còn tồn tại (HTTP 404). Hãy xác minh phiên bản backend.'
  }
  if (cause.status === 400 || cause.status === 422) {
    if (/version|phiên bản/i.test(cause.message)) {
      return `Phiên bản Rich Text không tương thích với backend: ${cause.message}`
    }
    return `Backend từ chối Rich Text document hoặc chưa hỗ trợ contentFormat/contentJson: ${cause.message}`
  }
  return cause.message
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function validateSavedRichArticle(article: NewsArticle, expected: NewsRichDocument): string | null {
  if (article.contentFormat !== 'tiptap-json') {
    return 'Backend không xác nhận đã lưu Rich Text. Hãy tải lại bài viết và xác minh backend trước khi thử lại.'
  }
  const issue = getNewsRichDocumentIssue(article.contentJson)
  if (issue) return NEWS_RICH_DOCUMENT_ISSUE_MESSAGES[issue]
  return stableJson(article.contentJson) === stableJson(expected)
    ? null
    : 'Backend trả về Rich Text khác với nội dung vừa gửi. Không tiếp tục xuất bản để tránh mất định dạng.'
}

function AdminNewsFormPage() {
  const { id } = useParams()
  const { request } = useAdmin()
  const [article, setArticle] = useState<NewsArticle>()
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let active = true
    request<NewsArticle>(`/admin/news/${id}`)
      .then((data) => {
        if (!active) return
        if (data.contentFormat === 'tiptap-json') {
          const issue = getNewsRichDocumentIssue(data.contentJson)
          if (issue) {
            setError(NEWS_RICH_DOCUMENT_ISSUE_MESSAGES[issue])
            return
          }
        } else if (data.contentFormat !== undefined && data.contentFormat !== 'markdown') {
          setError('API trả về định dạng nội dung không được hỗ trợ; bài viết chưa được mở để tránh ghi đè.')
          return
        }
        setArticle(data)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải bài viết.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, request])

  if (loading) return <p className={styles.emptyState} aria-live="polite">Đang tải biểu mẫu…</p>
  if (error || (id && !article)) {
    return (
      <section className={styles.panel} role="alert">
        <h1>{error ? 'Không thể tải dữ liệu' : 'Không tìm thấy bài viết'}</h1>
        <p className={styles.pageSubtitle}>{error || 'Bài viết không tồn tại hoặc đã bị xóa.'}</p>
        <Link className={styles.buttonSecondary} to="/admin/news">Quay lại danh sách</Link>
      </section>
    )
  }

  return <NewsForm key={article?.id ?? 'new'} article={article} />
}

function NewsForm({ article }: { article?: NewsArticle }) {
  const navigate = useNavigate()
  const { request, setNotice } = useAdmin()
  const [currentArticle, setCurrentArticle] = useState(article)
  const [initial] = useState<Draft>(() =>
    article
      ? { title: article.title, slug: article.slug, category: article.category, summary: article.summary, content: article.content }
      : emptyDraft,
  )
  const [initialRich] = useState<NewsRichDocument>(() => article?.contentJson ?? createEmptyNewsRichDocument())
  const editorMode: EditorMode = !article || article.contentFormat === 'tiptap-json' ? 'rich' : 'markdown'
  const [draft, setDraft] = useState<Draft>(initial)
  const [richDraft, setRichDraft] = useState(initialRich)
  const [errors, setErrors] = useState<Errors>({})
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    JSON.stringify(richDraft) !== JSON.stringify(initialRich)

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function persist(publish: boolean) {
    const contentChanged = editorMode === 'rich'
      ? !currentArticle || JSON.stringify(richDraft) !== JSON.stringify(initialRich)
      : draft.content !== initial.content

    if (editorMode === 'rich') {
      const issue = getNewsRichDocumentIssue(richDraft)
      if (issue) {
        setSaveError(NEWS_RICH_DOCUMENT_ISSUE_MESSAGES[issue])
        return
      }
      if (!hasNewsRichContent(richDraft)) {
        setSaveError('Nội dung Rich Text cần có ít nhất một đoạn văn bản hoặc ảnh trước khi lưu.')
        return
      }
    }

    const found = validateNews(draft)
    if (editorMode === 'rich') delete found.content
    setErrors(found)
    const firstInvalid = (
      editorMode === 'rich'
        ? ['title', 'slug', 'category', 'summary']
        : ['title', 'slug', 'category', 'summary', 'content']
    ).find((key) => found[key as keyof Draft])
    if (firstInvalid) {
      setPreview(false)
      window.setTimeout(() => document.getElementById(`news-${firstInvalid}`)?.focus(), 0)
      return
    }

    const body = currentArticle
      ? buildNewsPatchPayload(draft, editorMode, richDraft, contentChanged)
      : buildNewsCreatePayload(draft, editorMode, richDraft)

    setSaving(true)
    setSaveError('')
    let savedArticle: NewsArticle | undefined
    try {
      savedArticle = await request<NewsArticle>(currentArticle ? `/admin/news/${currentArticle.id}` : '/admin/news', {
        method: currentArticle ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      setCurrentArticle(savedArticle)
      if (editorMode === 'rich') {
        const responseError = validateSavedRichArticle(savedArticle, richDraft)
        if (responseError) throw new Error(responseError)
      }
      if (publish && savedArticle.status !== 'PUBLISHED') {
        savedArticle = await request<NewsArticle>(`/admin/news/${savedArticle.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PUBLISHED' }),
        })
        setCurrentArticle(savedArticle)
        if (savedArticle.status !== 'PUBLISHED') throw new Error('Bài đã được lưu nhưng backend chưa xác nhận trạng thái xuất bản.')
      }
      setNotice(publish ? `Đã lưu và xuất bản “${body.title}”.` : `Đã lưu “${body.title}”.`)
      navigate('/admin/news')
    } catch (cause) {
      const message = editorMode === 'rich'
        ? richSaveError(cause)
        : cause instanceof ApiError ? cause.message : 'Không thể lưu bài viết. Vui lòng thử lại.'
      setSaveError(
        publish && savedArticle && savedArticle.status !== 'PUBLISHED'
          ? `Bản nháp đã được lưu nhưng chưa xuất bản: ${message}`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void persist(false)
  }

  const isPublished = currentArticle?.status === 'PUBLISHED'

  return (
    <>
      {/* <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>NỘI DUNG CỘNG ĐỒNG</p>
          <h1>{currentArticle ? 'Chỉnh sửa tin tức' : 'Tạo tin tức mới'}</h1>
          <p className={styles.pageSubtitle}>
            {currentArticle ? `Trạng thái hiện tại: ${isPublished ? 'đã xuất bản' : 'bản nháp'}.` : 'Bài mới được lưu dưới dạng bản nháp, chưa hiển thị công khai.'}
          </p>
        </div>
        <Link className={styles.buttonSecondary} to="/admin/news">← Danh sách tin tức</Link>
      </div> */}
      <form id="admin-news-form" onSubmit={submit} noValidate>
        <section className={`${styles.panel} ${styles.formSection}`}>
          <div className={`${styles.formGrid} ${styles.newsFormGrid}`}>
            <div className={styles.field}>
              <label htmlFor="news-title">Tiêu đề <span className={styles.requiredMark}>*</span></label>
              <input id="news-title" maxLength={200} value={draft.title} aria-invalid={Boolean(errors.title)} onChange={(event) => update('title', event.target.value)} />
              {errors.title && <p className={styles.fieldError} role="alert">{errors.title}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="news-slug">Đường dẫn (slug)</label>
              <input id="news-slug" maxLength={120} value={draft.slug} aria-invalid={Boolean(errors.slug)} onChange={(event) => update('slug', event.target.value)} />
              {errors.slug ? <p className={styles.fieldError} role="alert">{errors.slug}</p> : <p className={styles.fieldHint}>Để trống để tự tạo từ tiêu đề. Địa chỉ bài viết: /news/{draft.slug.trim() || '…'}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="news-category">Danh mục <span className={styles.requiredMark}>*</span></label>
              <input id="news-category" maxLength={50} value={draft.category} aria-invalid={Boolean(errors.category)} onChange={(event) => update('category', event.target.value)} />
              {errors.category && <p className={styles.fieldError} role="alert">{errors.category}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="news-summary">Tóm tắt <span className={styles.requiredMark}>*</span></label>
              <textarea id="news-summary" rows={3} maxLength={500} value={draft.summary} aria-invalid={Boolean(errors.summary)} onChange={(event) => update('summary', event.target.value)} />
              {/* {errors.summary ? <p className={styles.fieldError} role="alert">{errors.summary}</p> : <p className={styles.fieldHint}>{draft.summary.length}/500 ký tự. Hiển thị ở trang chủ và danh sách tin tức.</p>} */}
            </div>
            <div className={`${styles.field} ${styles.formFullWidth}`}>
              <div className={styles.rowActions} role="group" aria-label="Nội dung tin tức">
                <label htmlFor={editorMode === 'rich' ? 'news-rich-content' : 'news-content'}>
                  Nội dung {editorMode === 'rich' ? 'Rich Text' : '(Markdown)'} <span className={styles.requiredMark}>*</span>
                </label>
                {editorMode === 'markdown' && (
                  <>
                    <button className={preview ? styles.buttonQuiet : styles.buttonSecondary} type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Soạn thảo</button>
                    <button className={preview ? styles.buttonSecondary : styles.buttonQuiet} type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Xem trước</button>
                  </>
                )}
              </div>
              {editorMode === 'rich' ? (
                <Suspense fallback={<p className={styles.fieldHint} aria-live="polite">Đang tải trình soạn thảo Rich Text…</p>}>
                  <NewsRichTextEditor initialValue={richDraft} onChange={setRichDraft} />
                </Suspense>
              ) : (
                preview ? (
                  <div className={styles.panel} aria-live="polite">
                    {draft.content.trim() ? <Markdown source={draft.content} /> : <p className={styles.fieldHint}>Chưa có nội dung để xem trước.</p>}
                  </div>
                ) : (
                  <textarea id="news-content" rows={14} maxLength={50000} value={draft.content} aria-invalid={Boolean(errors.content)} onChange={(event) => update('content', event.target.value)} />
                )
              )}
              {errors.content && <p className={styles.fieldError} role="alert">{errors.content}</p>}
              {editorMode === 'markdown' && <p className={styles.fieldHint}></p>}
            </div>
          </div>
        </section>
        {saveError && <p className={styles.formMessage} role="alert">{saveError}</p>}
        <div className={styles.formActions}>
          <button className={styles.buttonSecondary} type="button" disabled={saving} onClick={() => navigate('/admin/news')}>Hủy</button>
          <button className={styles.buttonSecondary} type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          {!isPublished && (
            <button className={styles.buttonPrimary} type="button" disabled={saving} onClick={() => void persist(true)}>Lưu và xuất bản</button>
          )}
        </div>
      </form>
    </>
  )
}

export default AdminNewsFormPage
