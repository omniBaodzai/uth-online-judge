import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Pagination from '../../../components/ui/Pagination'
import { useProblemCatalog } from '../../problems/problemCatalog'
import type { Problem } from '../../problems/data'
import type { Organization } from '../data'
import styles from '../pages/OrganizationDetailPage.module.css'

const pageSize = 10
const statusText = { solved: 'Đã giải', attempted: 'Đã thử, chưa đạt', unsolved: 'Chưa giải' } as const
const statusIcon = { solved: '✓', attempted: '!', unsolved: '○' } as const

function OrganizationProblemsTab({ organization }: { organization: Organization }) {
  const { problems } = useProblemCatalog()
  const orgProblems = useMemo(
    () => organization.problemIds
      .map((id) => problems.find((problem) => problem.id === id))
      .filter((problem): problem is Problem => problem !== undefined),
    [organization, problems],
  )
  const groups = useMemo(() => [...new Set(orgProblems.map((problem) => problem.topic))], [orgProblems])
  const types = useMemo(() => [...new Set(orgProblems.flatMap((problem) => problem.tags))], [orgProblems])
  const maxScore = Math.max(0, ...orgProblems.map((problem) => problem.score))

  const [keyword, setKeyword] = useState('')
  const [hideSolved, setHideSolved] = useState(false)
  const [group, setGroup] = useState('')
  const [type, setType] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [upperOverride, setUpperScore] = useState<number | null>(null)
  const upperScore = upperOverride ?? maxScore
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase('vi')
    return orgProblems.filter((problem) =>
      (!term || problem.title.toLocaleLowerCase('vi').includes(term) || problem.id.toLowerCase().includes(term))
      && (!hideSolved || problem.status !== 'solved')
      && (!group || problem.topic === group)
      && (!type || problem.tags.includes(type))
      && problem.score >= minScore && problem.score <= upperScore)
  }, [orgProblems, keyword, hideSolved, group, type, minScore, upperScore])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  function reset() {
    setKeyword('')
    setHideSolved(false)
    setGroup('')
    setType('')
    setMinScore(0)
    setUpperScore(null)
    setPage(1)
  }

  return (
    <div className={styles.problemsLayout}>
      <section className={styles.card} aria-label="Danh sách bài tập của tổ chức">
        {visible.length === 0 ? (
          <p className={styles.empty}>Không có bài tập phù hợp với bộ lọc.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.iconCol}><span className={styles.srOnly}>Trạng thái</span></th>
                  <th scope="col">ID</th>
                  <th scope="col">Tên bài</th>
                  <th scope="col">Nhóm</th>
                  <th scope="col" className={styles.numeric}>Điểm</th>
                  <th scope="col" className={styles.numeric}>% AC</th>
                  <th scope="col" className={styles.numeric}>Số AC</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((problem) => {
                  const href = `/problems/${problem.id}?org=${organization.id}`
                  return (
                    <tr key={problem.id}>
                      <td className={styles.iconCol}>
                        <span className={`${styles.statusIcon} ${styles[problem.status]}`} title={statusText[problem.status]} role="img" aria-label={statusText[problem.status]}>
                          {statusIcon[problem.status]}
                        </span>
                      </td>
                      <td className={styles.mono}><Link to={href}>{problem.id}</Link></td>
                      <td>
                        <Link className={styles.problemTitle} to={href}>{problem.title}</Link>
                        <div className={styles.tags}>
                          {problem.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      </td>
                      <td>{problem.topic}</td>
                      <td className={styles.numeric}>{problem.score}</td>
                      <td className={styles.numeric}>{problem.acceptance.toFixed(1)}%</td>
                      <td className={styles.numeric}>{problem.acceptedCount.toLocaleString('vi-VN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.paginationRow}>
          <span>{filtered.length} bài tập</span>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} label="bài tập" />
        </div>
      </section>

      <aside className={styles.filterCard} aria-label="Tìm kiếm và lọc bài tập">
        <h2>Tìm kiếm</h2>
        <label className={styles.field}>
          <span>Từ khóa</span>
          <input type="search" value={keyword} placeholder="Tên hoặc mã bài..." onChange={(event) => update(setKeyword)(event.target.value)} />
        </label>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={hideSolved} onChange={(event) => update(setHideSolved)(event.target.checked)} />
          <span>Ẩn các bài đã AC</span>
        </label>
        <label className={styles.field}>
          <span>Nhóm bài</span>
          <select value={group} onChange={(event) => update(setGroup)(event.target.value)}>
            <option value="">Tất cả nhóm</option>
            {groups.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Dạng bài</span>
          <select value={type} onChange={(event) => update(setType)(event.target.value)}>
            <option value="">Tất cả dạng bài</option>
            {types.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className={styles.scoreRange}>
          <label className={styles.field}>
            <span>Điểm từ</span>
            <input type="number" min={0} max={upperScore} value={minScore} onChange={(event) => update(setMinScore)(Math.max(0, Number(event.target.value) || 0))} />
          </label>
          <label className={styles.field}>
            <span>đến</span>
            <input type="number" min={minScore} value={upperScore} onChange={(event) => update(setUpperScore)(Number(event.target.value) || 0)} />
          </label>
        </div>
        <button className={styles.resetButton} type="button" onClick={reset}>Đặt lại bộ lọc</button>
      </aside>
    </div>
  )
}

export default OrganizationProblemsTab
