import type { Contest } from '../data'
import { formatContestDate } from '../data'
import type { ContestDetailData } from '../detailData'
import styles from './ContestOverview.module.css'

type ContestOverviewProps = {
  contest: Contest
  details: ContestDetailData
}

function ContestOverview({ contest, details }: ContestOverviewProps) {
  return (
    <div className={styles.overview}>
      <section className={styles.contentPanel}>
        <div className={styles.sectionTitle}>
          <div><p>NỘI DUNG THI</p><h2>Bài tập</h2></div>
          <span>{details.problems.length} bài</span>
        </div>
        <div className={styles.problemTableWrap}>
          <table className={styles.problemTable}>
            <thead><tr><th>#</th><th>Tên bài tập</th><th>Điểm</th></tr></thead>
            <tbody>
              {details.problems.map((problem) => (
                <tr key={problem.code}>
                  <td className={styles.problemCode}>{problem.code}</td>
                  <td><a href={`/problems/${problem.problemId}`}>{problem.title}</a></td>
                  <td className={styles.points}>{problem.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a className={styles.allProblems} href="/problems">Tất cả bài tập <span aria-hidden="true">→</span></a>
      </section>

      <section className={styles.contentPanel}>
        <div className={styles.sectionTitle}>
          <div><p>TRAO ĐỔI</p><h2>Bình luận</h2></div>
          <span>{details.comments.length} bình luận</span>
        </div>
        <div className={styles.rulesBox}>
          <strong>Nội quy kỳ thi</strong>
          <ul>{details.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          <small>Bắt đầu: {formatContestDate(contest.startsAt)}</small>
        </div>
        <div className={styles.comments}>
          {details.comments.map((comment) => (
            <article className={styles.comment} key={`${comment.user}-${comment.time}`}>
              <span className={styles.commentAvatar} aria-hidden="true">{comment.user[0].toUpperCase()}</span>
              <div>
                <div className={styles.commentMeta}><strong>{comment.user}</strong><time>{comment.time}</time></div>
                <p>{comment.message}</p>
              </div>
            </article>
          ))}
        </div>
        <a className={styles.loginComment} href="/login">Đăng nhập để bình luận</a>
      </section>
    </div>
  )
}

export default ContestOverview