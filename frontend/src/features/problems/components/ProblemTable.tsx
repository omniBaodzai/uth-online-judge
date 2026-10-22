import type { Problem } from '../data'
import styles from './ProblemTable.module.css'

type ProblemTableProps = {
  problems: Problem[]
  highlightedProblemId: string | null
  isLoading?: boolean
}

function ProblemTable({ problems, highlightedProblemId, isLoading = false }: ProblemTableProps) {
  if (isLoading) {
    return (
      <div className={styles.emptyState}>
        <h3>Đang tải danh sách bài tập…</h3>
      </div>
    )
  }

  if (problems.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span aria-hidden="true">⌕</span>
        <h3>Không tìm thấy bài tập</h3>
        <p>Thử thay đổi từ khóa hoặc điều kiện lọc.</p>
      </div>
    )
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.problemTable}>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Tên bài</th>
            <th scope="col">Nhóm</th>
            <th scope="col">Điểm</th>
            <th scope="col">% AC</th>
            <th scope="col">Người AC</th>
            <th scope="col"><span className={styles.statusHeading}>Trạng thái</span></th>
          </tr>
        </thead>
        <tbody>
          {problems.map((problem) => (
            <tr
              className={highlightedProblemId === problem.id ? styles.highlightedRow : ''}
              id={`problem-${problem.id}`}
              key={problem.id}
            >
              <td className={styles.problemId}>
                <a href={`/problems/${problem.id}`} aria-label={`Mở bài ${problem.id}`}>{problem.id}</a>
              </td>
              <td className={styles.titleCell}>
                <a href={`/problems/${problem.id}`} className={styles.problemTitle}>{problem.title}</a>
                <div className={styles.tags}>
                  {problem.tags.map((tag) => (
                    <span className={styles.tag} key={tag}>{tag}</span>
                  ))}
                </div>
              </td>
              <td className={styles.topicCell}>{problem.topic}</td>
              <td className={styles.scoreCell}>{problem.score}</td>
              <td>
                <div className={styles.acceptanceCell}>
                  <span>{problem.acceptance.toFixed(1)}%</span>
                  <span className={styles.acceptanceTrack} aria-hidden="true">
                    <span style={{ width: `${problem.acceptance}%` }} />
                  </span>
                </div>
              </td>
              <td className={styles.acceptedCell}>{problem.acceptedCount.toLocaleString('vi-VN')}</td>
              <td>
                <span
                  className={`${styles.status} ${styles[problem.status]}`}
                  aria-label={problem.status === 'solved' ? 'Đã giải' : problem.status === 'attempted' ? 'Đã thử' : 'Chưa giải'}
                  title={problem.status === 'solved' ? 'Đã giải' : problem.status === 'attempted' ? 'Đã thử' : 'Chưa giải'}
                >
                  {problem.status === 'solved' ? '✓' : problem.status === 'attempted' ? '·' : '–'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ProblemTable