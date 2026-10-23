import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { type DiscussionDetail, useCommunityRequest } from '../api'
import { errorMessage } from '../useAsync'
import styles from '../community.module.css'

function DiscussionNewPage() {
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
      setError('Tiêu đề phải từ 5 đến 200 ký tự.')
      return
    }
    if (!trimmedContent || trimmedContent.length > 10000) {
      setError('Nội dung phải từ 1 đến 10.000 ký tự.')
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
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Tạo chủ đề mới</h1>
            <p>Mô tả rõ vấn đề để mọi người có thể hỗ trợ bạn nhanh hơn.</p>
          </div>
        </header>
        <form className={`${styles.card} ${styles.article} ${styles.form}`} onSubmit={submit} noValidate>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.field}>
            <label htmlFor="discussion-title">Tiêu đề</label>
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
            <label htmlFor="discussion-content">Nội dung</label>
            <textarea
              id="discussion-content"
              className={styles.textarea}
              value={content}
              maxLength={10000}
              rows={10}
              onChange={(event) => setContent(event.target.value)}
              required
            />
            <span className={styles.hint}>Văn bản thuần, tối đa 10.000 ký tự ({content.length}/10000).</span>
          </div>
          <div>
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              {busy ? 'Đang đăng…' : 'Đăng chủ đề'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default DiscussionNewPage
