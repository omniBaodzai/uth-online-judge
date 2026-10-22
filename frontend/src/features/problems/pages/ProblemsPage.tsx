import { useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import {
  difficultyLabels,
  difficultyOptions,
  sampleProblems,
  sampleTotalProblems,
  samplePageSize,
  statusLabels,
  statusOptions,
  topicOptions,
  type Problem,
} from '../data'
import styles from './ProblemsPage.module.css'

// Đổi giá trị để xem trước trạng thái tải / trống khi chưa có API.
const isLoading = false
const problems: Problem[] = sampleProblems

function ProblemsPage() {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(sampleTotalProblems / samplePageSize)

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LUYỆN TẬP</p>
          <h1>Bài tập</h1>
          <p className={styles.lead}>
            Luyện tập thuật toán, nâng cao kỹ năng lập trình và chinh phục những thử thách mới
          </p>
        </header>

        <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
          <div className={`${styles.field} ${styles.search}`}>
            <label htmlFor="problem-search">Tìm kiếm</label>
            <input
              id="problem-search"
              type="search"
              placeholder="Tên bài hoặc mã bài, ví dụ UTH001"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="problem-difficulty">Độ khó</label>
            <select id="problem-difficulty">
              {difficultyOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="problem-status">Trạng thái</label>
            <select id="problem-status">
              {statusOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="problem-topic">Chủ đề</label>
            <select id="problem-topic">
              {topicOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <button className={styles.reset} type="reset">
            Đặt lại
          </button>
        </form>

        <section className={styles.card} aria-label="Danh sách bài tập" aria-busy={isLoading}>
          <div className={styles.summary}>
            <span>
              Tổng số <strong>{sampleTotalProblems}</strong> bài tập
            </span>
          </div>

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
                    <th scope="col" className={styles.colStatus}>Trạng thái</th>
                    <th scope="col">Mã</th>
                    <th scope="col">Tên bài tập</th>
                    <th scope="col">Độ khó</th>
                    <th scope="col" className={styles.colRate}>Tỷ lệ AC</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Trạng thái" className={styles.colStatus}>
                        <span className={`${styles.status} ${styles[p.status]}`}>
                          <i aria-hidden="true" />
                          {statusLabels[p.status]}
                        </span>
                      </td>
                      <td data-label="Mã" className={styles.code}>{p.code}</td>
                      <td data-label="Tên bài tập">
                        <div>
                          <Link className={styles.titleLink} to={`/problems/${p.code}`}>
                            {p.title}
                          </Link>
                          <ul className={styles.tags}>
                            {p.topics.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      </td>
                      <td data-label="Độ khó">
                        <span className={`${styles.badge} ${styles[p.difficulty]}`}>
                          {difficultyLabels[p.difficulty]}
                        </span>
                      </td>
                      <td data-label="Tỷ lệ AC" className={styles.colRate}>
                        <span className={styles.rate}>{p.acceptanceRate.toFixed(1)}%</span>
                        <span className={styles.bar} aria-hidden="true">
                          <span style={{ width: `${p.acceptanceRate}%` }} />
                        </span>
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
        </section>
      </div>
    </main>
  )
}

export default ProblemsPage
