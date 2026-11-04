import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { type DiscussionDetail, useCommunityRequest } from '../api'
import { errorMessage } from '../useAsync'
import { communityText } from '../translate'
import styles from '../community.module.css'

function DiscussionNewPage() {
  const { t, i18n } = useTranslation('pages')
  const text = (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
    communityText(t, i18n.resolvedLanguage ?? i18n.language, key, vi, en, values)
  const { request } = useCommunityRequest()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (trimmedTitle.length < 5 || trimmedTitle.length > 200) {
      setError(text('discussionTitleValidation', 'Tiêu đề phải từ 5 đến 200 ký tự.', 'The title must be between 5 and 200 characters.'))
      return
    }
    if (!trimmedContent || trimmedContent.length > 10000) {
      setError(text('discussionContentValidation', 'Nội dung phải từ 1 đến 10.000 ký tự.', 'Content must be between 1 and 10,000 characters.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await request<DiscussionDetail>('/discussions', {
        method: 'POST',
        body: JSON.stringify({ title: trimmedTitle, content: trimmedContent }),
      })
      navigate(`/discussions/${encodeURIComponent(created.id)}`)
    } catch (caught) {
      setError(errorMessage(caught, text('genericError', 'Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.')))
      setBusy(false)
    }
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>{text('createDiscussionTitle', 'Tạo chủ đề mới', 'Create a discussion')}</h1>
            <p>{text('createDiscussionHint', 'Mô tả rõ vấn đề để mọi người có thể hỗ trợ bạn nhanh hơn.', 'Describe the issue clearly so others can help you faster.')}</p>
          </div>
        </header>
        <form className={`${styles.card} ${styles.article} ${styles.form}`} onSubmit={submit} noValidate>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.field}>
            <label htmlFor="discussion-title">{text('title', 'Tiêu đề', 'Title')}</label>
            <input
              id="discussion-title"
              className={styles.input}
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="discussion-content">{text('content', 'Nội dung', 'Content')}</label>
            <textarea
              id="discussion-content"
              className={styles.textarea}
              value={content}
              maxLength={10000}
              rows={10}
              onChange={(event) => setContent(event.target.value)}
              required
            />
            <span className={styles.hint}>{text('plainTextLimit', 'Văn bản thuần, tối đa 10.000 ký tự ({{count}}/10000).', 'Plain text, up to 10,000 characters ({{count}}/10000).', {
              count: content.length.toLocaleString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'),
            })}</span>
          </div>
          <div>
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              {busy ? text('postingDiscussion', 'Đang đăng…', 'Posting…') : text('postDiscussion', 'Đăng chủ đề', 'Post discussion')}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default DiscussionNewPage
