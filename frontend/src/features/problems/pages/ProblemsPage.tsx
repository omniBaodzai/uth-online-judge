import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import { ApiError } from '../../auth/api'
import { fetchProblems, fetchTags, type ProblemListItem, type Tag } from '../api'
import FilterDropdown from '../components/FilterDropdown'
import { statusLabels, statusOptions, type ProblemStatus } from '../data'
import { useProblemsFetcher } from '../useProblemsFetcher'
import styles from './ProblemsPage.module.css'

const PAGE_SIZE = 20
const LATEST_COUNT = 5

const statusFilterOptions = statusOptions.map((value) => ({ value, label: statusLabels[value] }))

function StatusIcon({ status }: { status: ProblemStatus }) {
  const label = statusLabels[status]
  return (
    <span className={`${styles.statusIcon} ${styles[status]}`} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {status === 'solved' && <path d="m6 12.5 4 4 8-9" />}
        {status === 'wrong' && <path d="m7 7 10 10M17 7 7 17" />}
        {status === 'unsolved' && <circle cx="12" cy="12" r="1.2" />}
      </svg>
    </span>
  )
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('vi-VN') : ''
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.'
}

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: ProblemListItem[]; total: number }

function ProblemsPage() {
  const { fetcher, ready } = useProblemsFetcher()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [topicFilter, setTopicFilter] = useState<string[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [latest, setLatest] = useState<ProblemListItem[]>([])
  const [list, setList] = useState<ListState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // Chờ người dùng ngừng gõ rồi mới gọi API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    fetchTags(fetcher)
      .then((result) => !cancelled && setTags(result))
      .catch(() => undefined) // Thiếu danh sách chủ đề chỉ làm mất bộ lọc, không chặn danh sách bài.
    return () => {
      cancelled = true
    }
  }, [fetcher])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchProblems(fetcher, { pageSize: LATEST_COUNT, sort: 'createdAt', order: 'desc' })
      .then((result) => !cancelled && setLatest(result.items))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, reloadKey])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setList({ phase: 'loading' })
    fetchProblems(fetcher, {
      page,
      pageSize: PAGE_SIZE,
      sort: 'createdAt',
      order: 'desc',
      search,
      tags: topicFilter,
      status: statusFilter[0] as ProblemStatus | undefined,
    })
      .then((result) => {
        if (!cancelled) setList({ phase: 'ready', items: result.items, total: result.total })
      })
      .catch((error: unknown) => {
        if (!cancelled) setList({ phase: 'error', message: errorMessage(error) })
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, page, search, statusFilter, topicFilter, reloadKey])

  const topicFilterOptions = tags.map((tag) => ({ value: tag.slug, label: tag.name }))
  const isLoading = list.phase === 'loading'
  const totalPages = list.phase === 'ready' ? Math.ceil(list.total / PAGE_SIZE) : 0

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <h1 id="problems-title" className={styles.title}>Danh sách bài tập</h1>

          <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
            <div className={styles.search}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                type="search"
                aria-label="Tìm kiếm bài tập"
                placeholder="Tìm kiếm bài tập theo tên hoặc mã bài tập..."
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <FilterDropdown
              label="Trạng thái"
              options={statusFilterOptions}
              selected={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            />
            <FilterDropdown
              label="Chủ đề"
              options={topicFilterOptions}
              selected={topicFilter}
              multiple
              onChange={(value) => {
                setTopicFilter(value)
                setPage(1)
              }}
            />
          </form>

          <div className={styles.card} aria-busy={isLoading}>
            {list.phase === 'loading' ? (
              <ul className={styles.skeletons} aria-label="Đang tải dữ liệu">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className={styles.skeleton} />
                ))}
              </ul>
            ) : list.phase === 'error' ? (
              <div className={styles.empty} role="alert">
                <strong>Không thể tải danh sách bài tập</strong>
                <p>{list.message}</p>
                <button className={styles.retry} type="button" onClick={() => setReloadKey((key) => key + 1)}>
                  Thử lại
                </button>
              </div>
            ) : list.items.length === 0 ? (
              <div className={styles.empty}>
                <strong>Không tìm thấy bài tập phù hợp</strong>
                <p>Hãy thử đổi từ khóa hoặc nới lỏng bộ lọc.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.center}>Trạng thái</th>
                      <th scope="col">Mã bài tập</th>
                      <th scope="col">Tên bài tập</th>
                      <th scope="col" className={styles.num}>Điểm</th>
                      <th scope="col" className={styles.num}>Tỷ lệ AC</th>
                      <th scope="col" className={styles.num}>Số lượng AC</th>
                      <th scope="col" className={styles.center}>Lời giải</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((p) => (
                      <tr key={p.code}>
                        <td className={styles.center}><StatusIcon status={p.status} /></td>
                        <td className={styles.code}>{p.code}</td>
                        <td>
                          <Link className={styles.titleLink} to={`/problems/${p.code}`}>
                            {p.title}
                          </Link>
                        </td>
                        <td className={styles.num}>{p.scoringEnabled ? p.points : '—'}</td>
                        <td className={styles.num}>{p.acceptanceRate.toFixed(1)}%</td>
                        <td className={styles.num}>{p.acCount.toLocaleString('vi-VN')}</td>
                        <td className={styles.center}>
                          {p.hasSolution ? (
                            <Link
                              className={styles.solutionLink}
                              to={`/problems/${p.code}/solution`}
                              aria-label={`Lời giải bài ${p.title}`}
                              title="Xem lời giải"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
                              </svg>
                            </Link>
                          ) : (
                            <span className={styles.noSolution} aria-label="Chưa có lời giải">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.footer}>
              <Pagination
                label="bài tập"
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </div>

        <aside className={styles.latest} aria-labelledby="latest-title">
          <h2 id="latest-title">Bài tập mới nhất</h2>
          {latest.length === 0 ? (
            <p>Chưa có bài tập nào được xuất bản.</p>
          ) : (
            <ol className={styles.latestList}>
              {latest.map((p) => (
                <li key={p.code}>
                  <Link to={`/problems/${p.code}`}>
                    <span className={styles.latestTitle}>{p.title}</span>
                    <span className={styles.latestMeta}>
                      {p.code} · {formatDate(p.publishedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  )
}

export default ProblemsPage
