import { Link } from 'react-router-dom'
import { formatExecutionTime, formatMemory, getVerdictBadge, type Submission } from '../data'
import styles from './SubmissionTable.module.css'

type SubmissionTableProps = {
  items: Submission[]
  isLoading?: boolean
  hasFilters: boolean
  // Trang theo từng bài tập đã nêu tên bài ở tiêu đề nên không lặp lại cột này.
  hideProblem?: boolean
}

const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

function SubmissionTable({ items, isLoading = false, hasFilters, hideProblem = false }: SubmissionTableProps) {
  if (isLoading) {
    return (
      <ul className={styles.skeletons} aria-label="Đang tải dữ liệu" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>{hasFilters ? 'Không tìm thấy bài nộp phù hợp' : 'Chưa có bài nộp nào'}</strong>
        <p>{hasFilters ? 'Hãy thử đổi từ khóa hoặc đặt lại bộ lọc.' : 'Các bài nộp mới sẽ xuất hiện tại đây.'}</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap} tabIndex={0} role="region" aria-label="Bảng danh sách bài nộp">
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Kết quả</th>
            <th scope="col">Thời gian nộp</th>
            <th scope="col">Coder</th>
            {!hideProblem && <th scope="col">Tên bài tập</th>}
            <th scope="col">Ngôn ngữ</th>
            <th scope="col" className={styles.num}>Thời gian chạy</th>
            <th scope="col" className={styles.num}>Bộ nhớ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const meta = getVerdictBadge(item.status)
            const date = new Date(item.submittedAt)
            const validDate = !Number.isNaN(date.getTime())
            const badgeStyle = { color: meta.color, background: meta.background }
            return (
              <tr key={item.id}>
                <td>
                  {/* Chỉ chủ bài nộp mới xem được chi tiết, nên người khác chỉ thấy nhãn kết quả. */}
                  {item.canViewDetails ? (
                    <Link
                      className={`${styles.badge} ${styles.badgeLink}`}
                      style={badgeStyle}
                      to={`/submissions/${encodeURIComponent(item.id)}`}
                      title={`${meta.name} — xem chi tiết`}
                    >
                      {meta.abbr}
                    </Link>
                  ) : (
                    <span className={styles.badge} style={badgeStyle} title={meta.name}>
                      {meta.abbr}
                    </span>
                  )}
                </td>
                <td className={styles.time}>
                  <span>{validDate ? dateFormat.format(date) : '—'}</span>
                  <span>{validDate ? timeFormat.format(date) : ''}</span>
                </td>
                {/* Chưa có route hồ sơ công khai nên chưa gắn liên kết cho coder. */}
                <td className={styles.coder}>{item.username ?? 'Ẩn danh'}</td>
                {!hideProblem && (
                  <td>
                    <Link className={styles.problem} to={`/problems/${encodeURIComponent(item.problemCode)}`}>
                      {item.problemTitle}
                    </Link>
                    <span className={styles.code}>{item.problemCode}</span>
                  </td>
                )}
                <td className={styles.lang}>{item.language}</td>
                <td className={styles.num}>{formatExecutionTime(item.executionTimeMs)}</td>
                <td className={styles.num}>{formatMemory(item.memoryUsedKb)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default SubmissionTable
