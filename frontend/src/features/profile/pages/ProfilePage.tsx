import { useState } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import ContributionHeatmap from '../components/ContributionHeatmap'
import RatingHistoryChart from '../components/RatingHistoryChart'
import { userProfiles } from '../data'
import styles from './ProfilePage.module.css'

type ProfilePageProps = {
  username: string
}

type ProfileTab = 'overview' | 'statistics' | 'blog'

const tabs: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Thông tin' },
  { id: 'statistics', label: 'Thống kê' },
  { id: 'blog', label: 'Blog' },
]

function ProfilePage({ username }: ProfilePageProps) {
  const profile = userProfiles[username.toLocaleLowerCase('vi')]
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')

  if (!profile) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={styles.notFound}>
          <p>UTH ONLINE JUDGE · THÀNH VIÊN</p>
          <h1>Không tìm thấy hồ sơ</h1>
          <span>Username <strong>{username}</strong> chưa có trong dữ liệu mẫu.</span>
          <a href="/leaderboard">Quay lại bảng xếp hạng</a>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Điều hướng đường dẫn">
          <a href="/leaderboard">Thành viên</a><span aria-hidden="true">/</span><span>{profile.handle}</span>
        </nav>

        <section className={styles.profileHeader}>
          <div className={styles.profileHeading}>
            <span className={styles.headerAvatar} aria-hidden="true">{profile.avatarText}</span>
            <div>
              <p>HỒ SƠ THÀNH VIÊN</p>
              <h1>{profile.handle}</h1>
              <span>{profile.fullName}</span>
            </div>
          </div>
          <nav className={styles.tabs} role="tablist" aria-label="Nội dung hồ sơ">
            {tabs.map((tab) => (
              <button
                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                id={`profile-tab-${tab.id}`}
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="profile-tab-panel"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </section>

        <div className={styles.profileLayout}>
          <aside className={styles.sidebar} aria-label="Tóm tắt hồ sơ">
            <section className={styles.memberCard}>
              <div className={styles.avatarLarge}>{profile.avatarText}</div>
              <h2>{profile.fullName}</h2>
              <p className={styles.username}>@{profile.handle}</p>
              <p className={styles.joined}>Thành viên từ {profile.joinedAt}</p>
              <div className={styles.summaryStats}>
                <Stat label="Bài đã giải" value={profile.solved.toLocaleString('vi-VN')} />
                <Stat label="Hạng điểm" value={`#${profile.rank}`} />
                <Stat label="Tổng điểm" value={profile.score.toFixed(2).replace('.', ',')} />
                <Stat label="Đóng góp" value={profile.contributions.toLocaleString('vi-VN')} />
              </div>
              <a className={styles.submissionsLink} href={`/submissions?username=${encodeURIComponent(profile.handle)}`}>
                Xem các bài nộp <span aria-hidden="true">→</span>
              </a>
            </section>

            <section className={styles.contestStats}>
              <h2>Thống kê cuộc thi</h2>
              <Stat label="Đã tham gia" value={`${profile.contestsParticipated} kỳ`} />
              <Stat label="Hạng rating" value={`#${profile.contestRank}`} />
              <Stat label="Rating hiện tại" value={profile.rating.toLocaleString('vi-VN')} />
              <Stat label="Thấp nhất" value={profile.minRating.toLocaleString('vi-VN')} />
              <Stat label="Cao nhất" value={profile.maxRating.toLocaleString('vi-VN')} />
              <span className={styles.ratingBadge}>◆ {profile.rating >= 2400 ? 'Expert' : profile.rating >= 2000 ? 'Candidate Master' : 'Specialist'}</span>
            </section>
          </aside>

          <section
            className={styles.content}
            id="profile-tab-panel"
            role="tabpanel"
            aria-labelledby={`profile-tab-${activeTab}`}
            aria-live="polite"
          >
            {activeTab === 'overview' && <Overview profile={profile} />}
            {activeTab === 'statistics' && (
              <div className={styles.contentStack}>
                <section className={styles.statisticsCards}>
                  <Stat label="Tổng số bài giải" value={profile.solved.toLocaleString('vi-VN')} />
                  <Stat label="Tổng điểm" value={profile.score.toFixed(2).replace('.', ',')} />
                  <Stat label="Số cuộc thi" value={profile.contestsParticipated.toLocaleString('vi-VN')} />
                  <Stat label="Rating hiện tại" value={profile.rating.toLocaleString('vi-VN')} />
                </section>
                <ContributionHeatmap days={profile.activityDays} />
                <RatingHistoryChart points={profile.ratingHistory} currentRating={profile.rating} minRating={profile.minRating} maxRating={profile.maxRating} />
              </div>
            )}
            {activeTab === 'blog' && <BlogList profile={profile} />}
          </section>
        </div>
      </main>
    </div>
  )
}

function Overview({ profile }: { profile: (typeof userProfiles)[string] }) {
  return (
    <div className={styles.contentStack}>
      <section className={styles.bioCard}>
        <div className={styles.sectionHeading}><div><p>GIỚI THIỆU</p><h2>Về tôi</h2></div><span aria-hidden="true">“</span></div>
        <p className={styles.bioText}>{profile.bio}</p>
        <div className={styles.organizationInfo}>
          <span className={styles.organizationIcon} aria-hidden="true">▦</span>
          <div><small>Trường / tổ chức</small><strong>{profile.institution}</strong></div>
        </div>
      </section>

      <ContributionHeatmap days={profile.activityDays} />
      <RatingHistoryChart points={profile.ratingHistory} currentRating={profile.rating} minRating={profile.minRating} maxRating={profile.maxRating} />

      <section className={styles.personalNote}>
        <div className={styles.noteMark} aria-hidden="true">UTH</div>
        <div><p>HỌC TẬP · CHIA SẺ · BỨT PHÁ</p><h2>Mỗi bài toán là một bước tiến mới.</h2><span>Tham gia cộng đồng UTH Online Judge từ {profile.joinedAt}.</span></div>
      </section>
    </div>
  )
}

function BlogList({ profile }: { profile: (typeof userProfiles)[string] }) {
  return (
    <div className={styles.blogPanel}>
      <div className={styles.sectionHeading}><div><p>GHI CHÚ CÁ NHÂN</p><h2>Blog của @{profile.handle}</h2></div><span>{profile.articles.length} bài viết</span></div>
      <div className={styles.articleList}>
        {profile.articles.map((article) => (
          <article className={styles.article} key={article.title}>
            <div className={styles.articleDate}>{article.publishedAt}</div>
            <div className={styles.articleBody}>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <span>{article.reads.toLocaleString('vi-VN')} lượt đọc</span>
            </div>
            <span className={styles.articleArrow} aria-hidden="true">→</span>
          </article>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={styles.stat}><span>{label}</span><strong>{value}</strong></div>
}

export default ProfilePage