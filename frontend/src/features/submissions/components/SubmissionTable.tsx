import { Link } from 'react-router-dom'
import { verdictMeta, type Submission } from '../data'
import styles from './SubmissionTable.module.css'

type SubmissionTableProps = {
  items: Submission[]
  isLoading?: boolean
  hasFilters: boolean
}

const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

function SubmissionTable({ items, isLoading = false, hasFilters }: SubmissionTableProps) {
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
            <th scope="col">Tên bài tập</th>
            <th scope="col">Ngôn ngữ</th>
            <th scope="col" className={styles.num}>Thời gian chạy</th>
            <th scope="col" className={styles.num}>Bộ nhớ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const meta = verdictMeta[item.verdict]
            const date = new Date(item.submittedAt)
            return (
              <tr key={item.id}>
                <td>
                  <span
                    className={styles.badge}
                    style={{ color: meta.color, background: meta.background }}
                    title={meta.name}
                  >
                    {item.verdict}
                  </span>
                </td>
                <td className={styles.time}>
                  <span>{dateFormat.format(date)}</span>
                  <span>{timeFormat.format(date)}</span>
                </td>
                {/* Chưa có route hồ sơ công khai nên chưa gắn liên kết cho coder. */}
                <td className={styles.coder}>{item.coder}</td>
                <td>
                  <Link className={styles.problem} to={`/problems/${item.problemCode}`}>
                    {item.problemTitle}
                  </Link>
                  <span className={styles.code}>{item.problemCode}</span>
                </td>
                <td className={styles.lang}>{item.language}</td>
                <td className={styles.num}>{item.timeMs === null ? '—' : `${item.timeMs} ms`}</td>
                <td className={styles.num}>{item.memoryMb === null ? '—' : `${item.memoryMb.toFixed(1)} MB`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default SubmissionTable
