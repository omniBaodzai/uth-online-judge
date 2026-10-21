import type { Contest } from '../data'
import { formatContestDate, formatContestDuration } from '../data'
import styles from './ContestsTable.module.css'

type ContestsTableProps = {
  contests: Contest[]
  onVirtualParticipate: (contest: Contest) => void
}

const kindLabels: Record<Contest['kind'], string> = {
  rated: 'rated',
  practice: 'luyện tập',
  unrated: 'unrated',
}

function ContestsTable({ contests: rows, onVirtualParticipate }: ContestsTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span aria-hidden="true">⌕</span>
        <h3>Không tìm thấy kỳ thi</h3>
        <p>Thử đổi từ khóa hoặc hiển thị các kỳ thi riêng tư.</p>
      </div>
    )
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.contestsTable}>
        <thead>
          <tr>
            <th scope="col">Kỳ thi</th>
            <th scope="col">Thành viên</th>
            <th scope="col"><span className={styles.actionHeading}>Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contest) => (
            <tr key={contest.id}>
              <td className={styles.contestCell}>
                <div className={styles.contestTitleRow}>
                  <a href={`/contests/${contest.id}`} className={styles.contestTitle}>{contest.name}</a>
                  <span className={`${styles.kindBadge} ${styles[contest.kind]}`}>{kindLabels[contest.kind]}</span>
                  {contest.isPrivate && <span className={styles.privateBadge}>riêng tư</span>}
                </div>
                <time className={styles.date} dateTime={contest.startsAt}>{formatContestDate(contest.startsAt)}</time>
                <span className={styles.duration}>Thời gian làm bài: {formatContestDuration(contest.durationMinutes)}</span>
              </td>
              <td className={styles.memberCell}>
                <strong>{contest.participants.toLocaleString('vi-VN')}</strong>
                <span>({contest.virtualParticipants.toLocaleString('vi-VN')})</span>
              </td>
              <td className={styles.actionCell}>
                <button type="button" onClick={() => onVirtualParticipate(contest)}>
                  <span aria-hidden="true">↗</span> Tham gia ảo
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ContestsTable