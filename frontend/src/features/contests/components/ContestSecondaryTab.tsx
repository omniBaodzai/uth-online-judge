import { contestStandings, contestSubmissions } from '../detailData'
import styles from './ContestSecondaryTab.module.css'

type ContestSecondaryTabProps = {
  type: 'statistics' | 'leaderboard' | 'submissions'
}

function ContestSecondaryTab({ type }: ContestSecondaryTabProps) {
  if (type === 'leaderboard') {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeading}><p>KẾT QUẢ CUỘC THI</p><h2>Bảng xếp hạng</h2></div>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th>Hạng</th><th>Thành viên</th><th>Đã giải</th><th>Thời gian phạt</th><th>Điểm</th></tr></thead>
            <tbody>{contestStandings.map((entry) => (
              <tr key={entry.username}>
                <td className={styles.rank}>#{entry.rank}</td>
                <td className={styles.username}>{entry.username}</td>
                <td>{entry.solved}</td>
                <td>{entry.penalty}</td>
                <td className={styles.score}>{entry.score.toLocaleString('vi-VN')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    )
  }

  if (type === 'submissions') {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeading}><p>HOẠT ĐỘNG GẦN ĐÂY</p><h2>Các bài nộp</h2></div>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th>Thành viên</th><th>Bài</th><th>Kết quả</th><th>Ngôn ngữ</th><th>Thời gian</th></tr></thead>
            <tbody>{contestSubmissions.map((entry, index) => (
              <tr key={`${entry.username}-${index}`}>
                <td className={styles.username}>{entry.username}</td>
                <td>{entry.problem}</td>
                <td><span className={`${styles.result} ${entry.result === 'AC' ? styles.accepted : styles.rejected}`}>{entry.result}</span></td>
                <td>{entry.language}</td>
                <td>{entry.time}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p>TỔNG QUAN KẾT QUẢ</p><h2>Thống kê</h2></div>
      <div className={styles.statsGrid}>
        <StatCard label="Thí sinh tham gia" value="41" detail="20 người thi trực tiếp" />
        <StatCard label="Bài nộp" value="1.286" detail="Trong thời gian cuộc thi" />
        <StatCard label="Lượt chấp nhận" value="462" detail="36% tổng bài nộp" />
        <StatCard label="Bài có lời giải" value="5 / 5" detail="Tất cả bài đã có người giải" />
      </div>
      <div className={styles.distribution}>
        <div className={styles.distributionHeading}><strong>Phân bố kết quả</strong><span>1.286 lượt nộp</span></div>
        <div className={styles.stackedBar} aria-label="36% AC, 27% WA, 21% TLE, 16% kết quả khác">
          <span className={styles.acSegment} />
          <span className={styles.waSegment} />
          <span className={styles.tleSegment} />
          <span className={styles.otherSegment} />
        </div>
        <div className={styles.legend}>
          <span><i className={styles.acDot} />AC 36%</span>
          <span><i className={styles.waDot} />WA 27%</span>
          <span><i className={styles.tleDot} />TLE 21%</span>
          <span><i className={styles.otherDot} />Khác 16%</span>
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className={styles.statCard}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

export default ContestSecondaryTab