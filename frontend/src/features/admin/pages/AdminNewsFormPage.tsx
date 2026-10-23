import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Markdown from '../../../components/ui/Markdown'
import { ApiError } from '../../auth/api'
import type { NewsArticle, NewsInput } from '../../community/api'
import { validateNews, type NewsDraft as Draft, type NewsErrors as Errors } from '../../community/validation'
import { useAdmin } from '../useAdmin'
import styles from '../admin.module.css'

const emptyDraft: Draft = { title: '', slug: '', category: 'Thông báo', summary: '', content: '' }

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
        if (active) setArticle(data)
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
  const [initial] = useState<Draft>(() =>
    article
      ? { title: article.title, slug: article.slug, category: article.category, summary: article.summary, content: article.content }
      : emptyDraft,
  )
  const [draft, setDraft] = useState<Draft>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

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
    const found = validateNews(draft)
    setErrors(found)
    const firstInvalid = (['title', 'slug', 'category', 'summary', 'content'] as const).find((key) => found[key])
    if (firstInvalid) {
      setPreview(false)
      window.setTimeout(() => document.getElementById(`news-${firstInvalid}`)?.focus(), 0)
      return
    }

    const body: NewsInput = {
      title: draft.title.trim(),
      category: draft.category.trim(),
      summary: draft.summary.trim(),
      content: draft.content.trim(),
    }
    if (draft.slug.trim()) body.slug = draft.slug.trim()

    setSaving(true)
    setSaveError('')
    try {
      const saved = await request<NewsArticle>(article ? `/admin/news/${article.id}` : '/admin/news', {
        method: article ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (publish && saved.status !== 'PUBLISHED') {
        await request(`/admin/news/${saved.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'PUBLISHED' }) })
      }
      setNotice(publish ? `Đã lưu và xuất bản “${body.title}”.` : `Đã lưu “${body.title}”.`)
      navigate('/admin/news')
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : 'Không thể lưu bài viết. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void persist(false)
  }

  const isPublished = article?.status === 'PUBLISHED'

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>NỘI DUNG CỘNG ĐỒNG</p>
          <h1>{article ? 'Chỉnh sửa tin tức' : 'Tạo tin tức mới'}</h1>
          <p className={styles.pageSubtitle}>
            {article ? `Trạng thái hiện tại: ${isPublished ? 'đã xuất bản' : 'bản nháp'}.` : 'Bài mới được lưu dưới dạng bản nháp, chưa hiển thị công khai.'}
          </p>
        </div>
        <Link className={styles.buttonSecondary} to="/admin/news">← Danh sách tin tức</Link>
      </div>
      <form id="admin-news-form" onSubmit={submit} noValidate>
        <section className={`${styles.panel} ${styles.formSection}`}>
          <div className={styles.formGrid}>
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
              {errors.summary ? <p className={styles.fieldError} role="alert">{errors.summary}</p> : <p className={styles.fieldHint}>{draft.summary.length}/500 ký tự. Hiển thị ở trang chủ và danh sách tin tức.</p>}
            </div>
            <div className={styles.field}>
              <div className={styles.rowActions} role="group" aria-label="Chế độ soạn thảo">
                <label htmlFor="news-content">Nội dung (Markdown) <span className={styles.requiredMark}>*</span></label>
                <button className={preview ? styles.buttonQuiet : styles.buttonSecondary} type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Soạn thảo</button>
                <button className={preview ? styles.buttonSecondary : styles.buttonQuiet} type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Xem trước</button>
              </div>
              {preview ? (
                <div className={styles.panel} aria-live="polite">
                  {draft.content.trim() ? <Markdown source={draft.content} /> : <p className={styles.fieldHint}>Chưa có nội dung để xem trước.</p>}
                </div>
              ) : (
                <textarea id="news-content" rows={14} maxLength={50000} value={draft.content} aria-invalid={Boolean(errors.content)} onChange={(event) => update('content', event.target.value)} />
              )}
              {errors.content && <p className={styles.fieldError} role="alert">{errors.content}</p>}
              <p className={styles.fieldHint}>Hỗ trợ: # tiêu đề, **đậm**, *nghiêng*, `mã`, danh sách, &gt; trích dẫn, khối mã ```, liên kết [chữ](https://…). HTML thô bị vô hiệu hóa.</p>
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
