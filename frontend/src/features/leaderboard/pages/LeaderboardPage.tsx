import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, resolveAvatarUrl } from '../../auth/api'
import { useProblemsFetcher } from '../../problems/useProblemsFetcher'
import UserAvatar from '../../profile/components/UserAvatar'
import { fetchLeaderboard, type LeaderboardPage as LeaderboardData } from '../api'
import styles from './LeaderboardPage.module.css'

const PAGE_SIZE = 20
type Sort = 'score' | 'contributions'

function ratingTier(rating: number | null): { label: string; color: string } | null {
  if (rating === null) return null
  if (rating >= 2400) return { label: 'Grandmaster', color: '#d93025' }
  if (rating >= 2100) return { label: 'Master', color: '#e8710a' }
  if (rating >= 1800) return { label: 'Expert', color: '#8f67d8' }
  if (rating >= 1500) return { label: 'Specialist', color: '#2e8eaa' }
  return { label: 'Newbie', color: '#8e9b9e' }
}

function pageWindow(current: number, total: number): (number | 'gap-start' | 'gap-end')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const sorted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const result: (number | 'gap-start' | 'gap-end')[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(index < sorted.length / 2 ? 'gap-start' : 'gap-end')
    result.push(page)
  })
  return result
}

function LeaderboardPage() {
  const { fetcher, ready } = useProblemsFetcher()
  const [searchParams, setSearchParams] = useSearchParams()
  const sort: Sort = searchParams.get('sort') === 'contributions' ? 'contributions' : 'score'
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchLeaderboard(fetcher, { page, pageSize: PAGE_SIZE, q: debounced, sort })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Không thể tải bảng xếp hạng.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, page, debounced, sort, reloadKey])

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages])

  function changeSort(next: Sort) {
    setPage(1)
    setSearchParams(next === 'score' ? {} : { sort: next })
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <h1>Bảng xếp hạng</h1>
          <nav className={styles.tabs} aria-label="Mục xếp hạng">
            <button
              type="button"
              className={sort === 'score' ? styles.tabActive : styles.tab}
              aria-current={sort === 'score' ? 'page' : undefined}
              onClick={() => changeSort('score')}
            >
              Bảng xếp hạng
            </button>
            <button
              type="button"
              className={sort === 'contributions' ? styles.tabActive : styles.tab}
              aria-current={sort === 'contributions' ? 'page' : undefined}
              onClick={() => changeSort('contributions')}
            >
              Đóng góp
            </button>
            <Link className={styles.tab} to="/organizations">Tổ chức</Link>
          </nav>
        </div>

        <section className={styles.card}>
          <div className={styles.toolbar}>
            <nav className={styles.pager} aria-label="Phân trang bảng xếp hạng">
              <button type="button" className={styles.pageButton} aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              {pages.map((item) =>
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    className={item === page ? styles.pageActive : styles.pageButton}
                    aria-current={item === page ? 'page' : undefined}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className={styles.gap} aria-hidden="true">…</span>
                ),
              )}
              <button type="button" className={styles.pageButton} aria-label="Trang sau" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
            </nav>
            <input
              className={styles.search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm bằng username"
              aria-label="Tìm kiếm bằng username"
              maxLength={50}
            />
          </div>

          {error ? (
            <div className={styles.state} role="alert">
              <p>{error}</p>
              <button type="button" className={styles.pageActive} onClick={() => setReloadKey((k) => k + 1)}>Thử lại</button>
            </div>
          ) : !data && loading ? (
            <p className={styles.state} role="status">Đang tải bảng xếp hạng…</p>
          ) : data && data.items.length === 0 ? (
            <div className={styles.state}>
              <strong>Không tìm thấy thành viên</strong>
              <p>Hãy thử username khác.</p>
            </div>
          ) : (
            <div className={styles.wrap} aria-busy={loading}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Hạng</th>
                    <th>Rating</th>
                    <th>Tên truy cập</th>
                    <th className={styles.num}>{sort === 'contributions' ? 'Đóng góp' : 'Điểm'}</th>
                    <th className={styles.num}>Số bài</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item) => {
                    const tier = ratingTier(item.rating)
                    const href = `/users/${encodeURIComponent(item.username)}`
                    return (
                      <tr key={item.username}>
                        <td className={styles.rank}>{item.rank}</td>
                        <td>
                          {tier ? (
                            <span className={styles.rating} style={{ color: tier.color }} title={tier.label}>
                              ◆ {item.rating}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td>
                          <Link className={styles.person} to={href}>
                            <UserAvatar source={resolveAvatarUrl(item.avatarUrl)} username={item.username} />
                            <span>
                              <strong style={{ color: item.rank === 1 ? '#d93025' : undefined }}>{item.username}</strong>
                              {item.fullName && <small>{item.fullName}</small>}
                            </span>
                          </Link>
                        </td>
                        <td className={styles.num}>{sort === 'contributions' ? item.contributions : item.totalScore.toFixed(2)}</td>
                        <td className={styles.num}>{item.solvedCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default LeaderboardPage
