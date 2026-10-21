import { useState } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import { contests, formatContestDate, formatContestDuration } from '../data'
import { contestDetails } from '../detailData'
import ContestOverview from '../components/ContestOverview'
import ContestSecondaryTab from '../components/ContestSecondaryTab'
import styles from './ContestDetailPage.module.css'

type ContestDetailPageProps = {
  contestId: string
}

type ContestTab = 'overview' | 'statistics' | 'leaderboard' | 'submissions'

const tabs: { id: ContestTab; label: string }[] = [
  { id: 'overview', label: 'Thông tin' },
  { id: 'statistics', label: 'Thống kê' },
  { id: 'leaderboard', label: 'Bảng xếp hạng' },
  { id: 'submissions', label: 'Các bài nộp' },
]

function ContestDetailPage({ contestId }: ContestDetailPageProps) {
  const contest = contests.find((item) => item.id.toLowerCase() === contestId.toLowerCase())
  const details = contestDetails[contestId.toLowerCase()]
  const [activeTab, setActiveTab] = useState<ContestTab>('overview')
  const [virtualNotice, setVirtualNotice] = useState('')

  if (!contest || !details) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.notFound}>
          <p>UTH ONLINE JUDGE</p>
          <h1>Không tìm thấy kỳ thi</h1>
          <span>Mã kỳ thi <strong>{contestId}</strong> không tồn tại hoặc chưa có dữ liệu.</span>
          <a href="/contests">Quay lại danh sách kỳ thi</a>
        </main>
      </div>
    )
  }

  const endsAt = new Date(new Date(contest.startsAt).getTime() + contest.durationMinutes * 60_000)
  const isEnded = endsAt.getTime() < Date.now()
  const status = isEnded ? 'Kỳ thi đã kết thúc' : new Date(contest.startsAt).getTime() > Date.now() ? 'Kỳ thi sắp diễn ra' : 'Kỳ thi đang diễn ra'
  const contestName = contest.name

  function handleVirtualParticipation() {
    setVirtualNotice(`Đã chọn tham gia ảo: ${contestName}. Bản demo chưa khởi tạo phiên thi.`)
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Điều hướng đường dẫn">
          <a href="/contests">Các kỳ thi</a><span aria-hidden="true">/</span><span>{contest.name}</span>
        </nav>

        <section className={styles.contestHero}>
          <div className={styles.heroMain}>
            <p className={styles.eyebrow}>UTH ONLINE JUDGE · CUỘC THI</p>
            <div className={styles.titleRow}>
              <h1>{contest.name}</h1>
              <span className={`${styles.kindBadge} ${styles[contest.kind]}`}>{contest.kind}</span>
            </div>
            <div className={styles.contestMeta}>
              <span><strong>{formatContestDate(contest.startsAt)}</strong></span>
              <span>Thời gian làm bài: <strong>{formatContestDuration(contest.durationMinutes)}</strong></span>
              <span><strong>{contest.participants.toLocaleString('vi-VN')}</strong> thí sinh</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <a className={styles.loginButton} href="/login">Đăng nhập để tham gia</a>
            {isEnded && <button className={styles.virtualButton} type="button" onClick={handleVirtualParticipation}>Tham gia ảo</button>}
          </div>

          <div className={`${styles.statusBanner} ${isEnded ? styles.ended : styles.active}`}>
            <span aria-hidden="true">{isEnded ? '✓' : '◷'}</span>
            <div>
              <strong>{status}</strong>
              <p>{formatContestDuration(contest.durationMinutes)} tính từ {formatContestDate(contest.startsAt)} +07</p>
            </div>
          </div>

          <nav className={styles.tabs} role="tablist" aria-label="Nội dung kỳ thi">
            {tabs.map((tab) => (
              <button
                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                id={`contest-tab-${tab.id}`}
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="contest-tab-panel"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </section>

        <div
          className={styles.tabPanel}
          id="contest-tab-panel"
          role="tabpanel"
          aria-labelledby={`contest-tab-${activeTab}`}
          aria-live="polite"
        >
          {activeTab === 'overview'
            ? <ContestOverview contest={contest} details={details} />
            : <ContestSecondaryTab type={activeTab} />}
        </div>
        <p className={styles.virtualNotice} aria-live="polite">{virtualNotice}</p>
      </main>
    </div>
  )
}

export default ContestDetailPage