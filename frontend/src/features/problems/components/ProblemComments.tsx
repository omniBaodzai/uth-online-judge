import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import styles from './ProblemComments.module.css'

type Comment = { id: number; author: string; content: string; time: string }

const initialComments: Comment[] = [
  { id: 1, author: 'minhanh', content: 'Bài này cần chú ý các trường hợp biên nhé mọi người.', time: '2 giờ trước' },
  { id: 2, author: 'hoangnam', content: 'Mình nộp lần đầu bị WA vì quên xử lý đầu vào có dấu cách thừa.', time: '1 ngày trước' },
]

function ProblemComments() {
  const { user, isAuthenticated } = useAuth()
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = content.trim()
    if (!text) return
    setComments((current) => [
      { id: Date.now(), author: user?.username ?? user?.email ?? 'bạn', content: text, time: 'Vừa xong' },
      ...current,
    ])
    setContent('')
  }

  return (
    <section className={styles.comments} aria-labelledby="problem-comments">
      <h2 id="problem-comments">Bình luận ({comments.length})</h2>
      {isAuthenticated ? (
        <form onSubmit={submit}>
          <label className={styles.srOnly} htmlFor="comment-input">Nội dung bình luận</label>
          <textarea id="comment-input" rows={3} maxLength={1000} value={content} placeholder="Viết bình luận của bạn..." onChange={(event) => setContent(event.target.value)} />
          <button type="submit" disabled={!content.trim()}>Gửi bình luận</button>
        </form>
      ) : (
        <p className={styles.login}><Link to="/login">Đăng nhập</Link> để bình luận.</p>
      )}
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>
            <span className={styles.avatar} aria-hidden="true">{comment.author.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{comment.author}</strong> <time>{comment.time}</time>
              <p>{comment.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ProblemComments
