import { useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import FilterDropdown from '../components/FilterDropdown'
import {
  latestProblems,
  sampleProblems,
  sampleTotalProblems,
  samplePageSize,
  statusLabels,
  statusOptions,
  topicOptions,
  type Problem,
  type ProblemStatus,
} from '../data'
import styles from './ProblemsPage.module.css'

// Đổi giá trị để xem trước trạng thái tải / trống khi chưa có API.
const isLoading = false
const problems: Problem[] = sampleProblems

const statusFilterOptions = statusOptions.map((value) => ({ value, label: statusLabels[value] }))
const topicFilterOptions = topicOptions.map((value) => ({ value, label: value }))

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN')
}

function ProblemsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [topicFilter, setTopicFilter] = useState<string[]>([])
  const totalPages = Math.ceil(sampleTotalProblems / samplePageSize)

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
              />
            </div>
            <FilterDropdown
              label="Trạng thái"
              options={statusFilterOptions}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterDropdown
              label="Chủ đề"
              options={topicFilterOptions}
              selected={topicFilter}
              multiple
              onChange={setTopicFilter}
            />
          </form>

          <div className={styles.card} aria-busy={isLoading}>
            {isLoading ? (
              <ul className={styles.skeletons} aria-label="Đang tải dữ liệu">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className={styles.skeleton} />
                ))}
              </ul>
            ) : problems.length === 0 ? (
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
                    {problems.map((p) => (
                      <tr key={p.id}>
                        <td className={styles.center}><StatusIcon status={p.status} /></td>
                        <td className={styles.code}>{p.code}</td>
                        <td>
                          <Link className={styles.titleLink} to={`/problems/${p.code}`}>
                            {p.title}
                          </Link>
                        </td>
                        <td className={styles.num}>{p.points}</td>
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
          <ol className={styles.latestList}>
            {latestProblems.map((p) => (
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
        </aside>
      </div>
    </main>
  )
}

export default ProblemsPage
