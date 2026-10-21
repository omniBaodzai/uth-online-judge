import type { Submission } from '../data'
import { statusDescriptions } from '../data'
import styles from './SubmissionTable.module.css'

type SubmissionTableProps = {
  submissions: Submission[]
}

function SubmissionTable({ submissions: rows }: SubmissionTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span aria-hidden="true">⌕</span>
        <h3>Không có bài nộp phù hợp</h3>
        <p>Hãy thử chọn điều kiện lọc khác.</p>
      </div>
    )
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.submissionTable}>
        <thead>
          <tr>
            <th scope="col">Kết quả / Ngôn ngữ</th>
            <th scope="col">Bài tập / Người nộp</th>
            <th scope="col">Thời gian</th>
            <th scope="col">Bộ nhớ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((submission) => (
            <tr key={submission.id}>
              <td>
                <div className={styles.resultCell}>
                  <span className={`${styles.resultTile} ${styles[submission.status]}`}>
                    {submission.status === 'AC'
                      ? `${submission.passedTests}/${submission.totalTests}`
                      : submission.status}
                  </span>
                  <span className={`${styles.statusLabel} ${styles[`label${submission.status}`]}`}>
                    <span aria-hidden="true" />
                    {submission.status}
                  </span>
                  <span className={styles.language}>{submission.language}</span>
                </div>
              </td>
              <td className={styles.problemCell}>
                <a className={styles.problemTitle} href={`/problems#problem-${submission.problemId}`}>
                  {submission.problemTitle}
                </a>
                <div className={styles.problemTags}>
                  {submission.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className={styles.submitter}>
                  <a href={`#user-${submission.username}`}>{submission.username}</a>
                  <span>·</span>
                  <time dateTime={submission.dateTime}>{submission.submittedAt}</time>
                </div>
              </td>
              <td className={styles.metricCell}>
                {submission.runtimeMs === null ? <span className={styles.notAvailable}>—</span> : `${(submission.runtimeMs / 1000).toFixed(2)}s`}
              </td>
              <td className={styles.metricCell}>
                {submission.memoryMb === null ? <span className={styles.notAvailable}>—</span> : `${submission.memoryMb.toFixed(1)} MB`}
              </td>
              <td className={styles.srOnly}>{statusDescriptions[submission.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SubmissionTable