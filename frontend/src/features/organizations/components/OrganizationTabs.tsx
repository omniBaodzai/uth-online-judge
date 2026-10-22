import { Link } from 'react-router-dom'
import type { Organization } from '../data'
import styles from '../pages/OrganizationDetailPage.module.css'

export function OrganizationHomeTab({ organization }: { organization: Organization }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardBody}>
        <h2>Giới thiệu</h2>
        <p>{organization.description}</p>
        <div className={styles.statGrid}>
          <div><span>Điểm tổ chức</span><strong>{organization.score.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}</strong></div>
          <div><span>Thành viên</span><strong>{organization.memberCount.toLocaleString('vi-VN')}</strong></div>
          <div><span>Bài tập</span><strong>{organization.problemIds.length}</strong></div>
          <div><span>Kỳ thi</span><strong>{organization.contests.length}</strong></div>
        </div>
        <Link className={styles.primaryLink} to={`/organizations/${organization.id}/problems`}>Xem danh sách bài →</Link>
      </div>
    </section>
  )
}

export function OrganizationMembersTab({ organization }: { organization: Organization }) {
  const members = [...organization.members].sort((first, second) => second.score - first.score)
  return (
    <section className={styles.card}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Thành viên</th><th scope="col">Vai trò</th>
              <th scope="col" className={styles.numeric}>Đã giải</th><th scope="col" className={styles.numeric}>Điểm</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.username}>
                <td className={styles.mono}>{index + 1}</td>
                <td><Link className={styles.problemTitle} to={`/profile/${member.username}`}>{member.username}</Link><span className={styles.sub}>{member.fullName}</span></td>
                <td>{member.role}</td>
                <td className={styles.numeric}>{member.solved}</td>
                <td className={styles.numeric}>{member.score.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>Hiển thị {members.length} trên {organization.memberCount.toLocaleString('vi-VN')} thành viên.</p>
    </section>
  )
}

export function OrganizationContestsTab({ organization }: { organization: Organization }) {
  if (organization.contests.length === 0) return <section className={styles.card}><p className={styles.empty}>Tổ chức chưa có kỳ thi nào.</p></section>
  return (
    <section className={styles.card}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Kỳ thi</th><th scope="col">Bắt đầu</th><th scope="col">Thời lượng</th>
              <th scope="col" className={styles.numeric}>Thí sinh</th><th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {organization.contests.map((contest) => (
              <tr key={contest.id}>
                <td className={styles.problemTitle}>{contest.title}</td>
                <td>{contest.startsAt}</td>
                <td>{contest.duration}</td>
                <td className={styles.numeric}>{contest.participants}</td>
                <td><span className={styles.pill}>{contest.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function OrganizationSubmissionsTab({ organization }: { organization: Organization }) {
  if (organization.submissions.length === 0) return <section className={styles.card}><p className={styles.empty}>Chưa có bài nộp nào trong tổ chức.</p></section>
  return (
    <section className={styles.card}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Bài</th><th scope="col">Người nộp</th><th scope="col">Kết quả</th>
              <th scope="col">Ngôn ngữ</th><th scope="col" className={styles.numeric}>Thời gian</th><th scope="col">Nộp lúc</th>
            </tr>
          </thead>
          <tbody>
            {organization.submissions.map((submission) => (
              <tr key={submission.id}>
                <td className={styles.mono}><Link to={`/problems/${submission.problemId}?org=${organization.id}`}>{submission.problemId}</Link></td>
                <td>{submission.username}</td>
                <td><span className={`${styles.pill} ${submission.status === 'AC' ? styles.ac : styles.fail}`}>{submission.status}</span></td>
                <td>{submission.language}</td>
                <td className={styles.numeric}>{submission.runtimeMs} ms</td>
                <td>{submission.submittedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
