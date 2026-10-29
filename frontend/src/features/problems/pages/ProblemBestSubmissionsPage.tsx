import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, resolveAvatarUrl } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { formatExecutionTime, formatMemory, getVerdictBadge } from '../../submissions/data'
import { fetchBestSubmissionSource, type BestSubmissionItem, type BestSubmissionSource } from '../api'
import ProblemStateMessage from '../components/ProblemStateMessage'
import { useBestSubmissions } from '../useBestSubmissions'
import { useProblemsFetcher } from '../useProblemsFetcher'
import styles from './ProblemBestSubmissionsPage.module.css'

const ReadOnlyCode = lazy(() => import('../../submissions/components/ReadOnlyCode'))

const PAGE_SIZE = 20
const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

function monacoLanguage(name: string): string {
  const language = name.toLowerCase()
  if (language.startsWith('c++') || language.startsWith('c ')) return 'cpp'
  if (language.startsWith('java')) return 'java'
  if (language.startsWith('python')) return 'python'
  if (language.startsWith('javascript')) return 'javascript'
  return 'plaintext'
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Vừa xong'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return dateFormat.format(date)
}

function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString('vi-VN')} B`
}

function Avatar({ item }: { item: BestSubmissionItem }) {
  const src = resolveAvatarUrl(item.user.avatarUrl)
  const name = item.user.fullName || item.user.username || '?'
  if (src) return <img className={styles.avatar} src={src} alt="" loading="lazy" />
  return (
    <span className={styles.avatar} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

type SourceModalProps = { code: string; item: BestSubmissionItem; onClose: () => void }

function SourceModal({ code, item, onClose }: SourceModalProps) {
  const { fetcher } = useProblemsFetcher()
  const [source, setSource] = useState<BestSubmissionSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchBestSubmissionSource(fetcher, code, item.id)
      .then((data) => {
        if (!cancelled) setSource(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Không thể tải mã nguồn.')
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, code, item.id])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function copy() {
    if (!source) return
    try {
      await navigator.clipboard.writeText(source.sourceCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Không thể sao chép mã nguồn.')
    }
  }

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="best-source-title">
        <div className={styles.dialogHeader}>
          <h2 id="best-source-title">
            Mã nguồn · {item.user.username ?? 'Ẩn danh'} · {item.language}
          </h2>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.button} onClick={copy} disabled={!source}>
              {copied ? 'Đã sao chép' : 'Sao chép code'}
            </button>
            <button type="button" className={styles.button} onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
        {error && <p className={styles.modalMessage} role="alert">{error}</p>}
        {!source && !error && <p className={styles.modalMessage} role="status">Đang tải mã nguồn…</p>}
        {source && (
          <Suspense fallback={<p className={styles.modalMessage}>Đang tải trình xem code…</p>}>
            <ReadOnlyCode code={source.sourceCode} language={monacoLanguage(source.language)} />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function ProblemBestSubmissionsPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const { state, retry } = useBestSubmissions(code, page, PAGE_SIZE)
  const [selected, setSelected] = useState<BestSubmissionItem | null>(null)
  const closeModal = useCallback(() => setSelected(null), [])

  if (state.phase !== 'ready') {
    return <ProblemStateMessage state={state} code={code} onRetry={retry} />
  }

  const { data } = state
  const backPath = `/problems/${data.problem.code}`
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <Link className={styles.button} to={backPath}>
            ← Quay lại trang bài tập
          </Link>
          <p className={styles.problemTitle}>
            {data.problem.code} — {data.problem.title}
          </p>
        </div>

        <section className={styles.card} aria-labelledby="best-title">
          <h1 id="best-title">Bài nộp tốt nhất</h1>
          {data.items.length === 0 ? (
            <div className={styles.empty}>
              <strong>Chưa có bài nộp tốt nhất</strong>
              <p>Hãy là người đầu tiên giải thành công bài tập này!</p>
              <Link className={`${styles.button} ${styles.primary}`} to={backPath}>
                Quay lại bài tập
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.wrap} tabIndex={0} role="region" aria-label="Bảng bài nộp tốt nhất">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>Người nộp</th>
                      <th>Trạng thái</th>
                      <th>Ngôn ngữ</th>
                      <th className={styles.num}>Thời gian</th>
                      <th className={styles.num}>Bộ nhớ</th>
                      <th className={styles.num}>Kích thước code</th>
                      <th>Thời gian nộp</th>
                      <th>
                        <span className={styles.srOnly}>Mã nguồn</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => {
                      const badge = getVerdictBadge(item.status)
                      return (
                        <tr key={item.id}>
                          <td className={styles.rank}>
                            #{item.rank}
                          </td>
                          <td>
                            <div className={styles.person}>
                              <Avatar item={item} />
                              <span>
                                <strong>{item.user.username ?? 'Ẩn danh'}</strong>
                                {item.user.fullName && <small>{item.user.fullName}</small>}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.badge} style={{ color: badge.color, background: badge.background }} title={badge.name}>
                              {badge.abbr} / {badge.name}
                            </span>
                          </td>
                          <td>{item.language}</td>
                          <td className={styles.num}>{formatExecutionTime(item.executionTimeMs)}</td>
                          <td className={styles.num}>{formatMemory(item.memoryUsedKb)}</td>
                          <td className={styles.num}>{formatBytes(item.codeLength)}</td>
                          <td>
                            <time dateTime={item.submittedAt} title={new Date(item.submittedAt).toLocaleString('vi-VN')}>
                              {formatRelativeTime(item.submittedAt)}
                            </time>
                          </td>
                          <td>
                            {user ? (
                              <button type="button" className={styles.button} onClick={() => setSelected(item)}>
                                Xem code
                              </button>
                            ) : (
                              <Link className={styles.button} to="/login" state={{ from: `/problems/${code}/submissions/best` }}>
                                Đăng nhập để xem
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <nav className={styles.pager} aria-label="Phân trang">
                  <button type="button" className={styles.button} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Trước
                  </button>
                  <span>
                    Trang {page} / {totalPages}
                  </span>
                  <button type="button" className={styles.button} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Sau
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
      {selected && <SourceModal code={code} item={selected} onClose={closeModal} />}
    </main>
  )
}

export default ProblemBestSubmissionsPage
