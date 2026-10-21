import type { LeaderboardCategory, Member, Organization } from '../data'
import styles from './LeaderboardTable.module.css'

type LeaderboardTableProps = {
  category: LeaderboardCategory
  members: Member[]
  organizations: Organization[]
  firstRank: number
}

function LeaderboardTable({ category, members, organizations, firstRank }: LeaderboardTableProps) {
  const isOrganizations = category === 'organizations'
  const isContributions = category === 'contributions'
  const isEmpty = isOrganizations ? organizations.length === 0 : members.length === 0

  if (isEmpty) {
    return (
      <div className={styles.emptyState}>
        <span aria-hidden="true">⌕</span>
        <h3>Không tìm thấy kết quả</h3>
        <p>Hãy thử tìm kiếm với username hoặc tên khác.</p>
      </div>
    )
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.leaderboardTable}>
        <thead>
          <tr>
            <th scope="col">Hạng</th>
            <th scope="col"><span className={styles.visuallyHidden}>Chỉ số</span></th>
            <th scope="col">{isOrganizations ? 'Tổ chức' : 'Tên truy cập'}</th>
            <th scope="col" className={styles.numberHeading}>{isContributions ? 'Đóng góp' : 'Điểm'}</th>
            <th scope="col" className={styles.numberHeading}>{isOrganizations ? 'Thành viên' : 'Số bài'}</th>
          </tr>
        </thead>
        <tbody>
          {isOrganizations
            ? organizations.map((organization, index) => (
              <tr key={organization.shortName}>
                <td><Rank rank={firstRank + index} /></td>
                <td>
                  <span className={`${styles.badge} ${firstRank + index <= 3 ? styles.topBadge : ''}`} aria-label={`${organization.members} thành viên`}>
                    <span aria-hidden="true">◆</span>{organization.members.toLocaleString('vi-VN')}
                  </span>
                </td>
                <td className={styles.identityCell}>
                  <span className={styles.organizationMark}>{organization.shortName.slice(0, 2)}</span>
                  <span className={styles.identity}>
                    <strong className={styles.organizationName}>{organization.name}</strong>
                    <small>{organization.shortName}</small>
                  </span>
                </td>
                <td className={styles.numeric}>{organization.score.toFixed(2).replace('.', ',')}</td>
                <td className={styles.numeric}>{organization.members.toLocaleString('vi-VN')}</td>
              </tr>
            ))
            : members.map((member, index) => (
              <tr key={member.handle}>
                <td><Rank rank={firstRank + index} /></td>
                <td>
                  <span className={`${styles.badge} ${firstRank + index <= 3 ? styles.topBadge : ''}`} aria-label={`Điểm phụ ${member.rating}`}>
                    <span aria-hidden="true">◆</span>{member.rating}
                  </span>
                </td>
                <td className={styles.identityCell}>
                  <span className={styles.avatar} aria-hidden="true">{member.handle.slice(0, 1).toUpperCase()}</span>
                  <span className={styles.identity}>
                    <a className={styles.username} href={`/profile/${encodeURIComponent(member.handle)}`}>{member.handle}</a>
                    <small>{member.fullName}</small>
                  </span>
                </td>
                <td className={styles.numeric}>{isContributions ? member.contributions : member.score.toFixed(2).replace('.', ',')}</td>
                <td className={styles.numeric}>{member.solved}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

function Rank({ rank }: { rank: number }) {
  return (
    <span className={`${styles.rank} ${rank <= 3 ? styles[`rank${rank}`] : ''}`}>
      {rank <= 3 && <span aria-hidden="true">◆</span>}
      {rank}
    </span>
  )
}

export default LeaderboardTable