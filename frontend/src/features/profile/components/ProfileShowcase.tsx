import type { DragEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Upload, X } from 'lucide-react'
import { resolveAvatarUrl } from '../../auth/api'
import UserAvatar from './UserAvatar'
import ProfileActivityHeatmap from './ProfileActivityHeatmap'
import type { ProfileViewModel } from '../api'
import styles from './ProfileShowcase.module.css'

type ProfileShowcaseProps = {
  profile: ProfileViewModel
  isOwner: boolean
  privateEmail?: string
  onEditCover?: () => void
  coverEditorOpen?: boolean
  coverUrl?: string
  coverError?: string
  isCoverBusy?: boolean
  onCloseCoverEditor?: () => void
  onCoverUrlChange?: (value: string) => void
  onApplyCoverUrl?: () => void
  onChooseCover?: () => void
  onDropCover?: (file: File | undefined) => void
  onRemoveCover?: () => void
}

function ProfileShowcase({
  profile,
  isOwner,
  privateEmail,
  onEditCover,
  coverEditorOpen = false,
  coverUrl = '',
  coverError = '',
  isCoverBusy = false,
  onCloseCoverEditor,
  onCoverUrlChange,
  onApplyCoverUrl,
  onChooseCover,
  onDropCover,
  onRemoveCover,
}: ProfileShowcaseProps) {
  const coverImage = profile.coverImageUrl?.startsWith('blob:')
    ? profile.coverImageUrl
    : resolveAvatarUrl(profile.coverImageUrl)
  const avatarImage = profile.avatarUrl?.startsWith('blob:')
    ? profile.avatarUrl
    : resolveAvatarUrl(profile.avatarUrl)
  const joined = new Date(profile.joinedAt)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    onDropCover?.(event.dataTransfer.files[0])
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onChooseCover?.()
    }
  }

  function handleUrlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApplyCoverUrl?.()
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.page}>
      <div className={styles.coverFrame}>
      <div
        className={styles.cover}
        style={profile.coverCrop ? {
          aspectRatio: String(profile.coverCrop.aspect),
          minHeight: 0,
        } : undefined}
      >
        {coverImage ? <img className={styles.coverImage} src={coverImage} alt="" /> : null}
        <div className={styles.coverOverlay} />
        <p>UTH ONLINE JUDGE</p>
        {isOwner && onEditCover ? (
          <button
            className={styles.coverEdit}
            type="button"
            aria-expanded={coverEditorOpen}
            aria-controls="cover-editor-popover"
            onClick={onEditCover}
          >
            Chỉnh sửa ảnh bìa
          </button>
        ) : null}
      </div>
      {isOwner && coverEditorOpen ? (
        <section
          className={styles.coverPopover}
          id="cover-editor-popover"
          role="dialog"
          aria-modal="false"
          aria-label="Tùy chọn ảnh bìa"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCloseCoverEditor?.()
          }}
        >
          <header className={styles.coverPopoverHeader}>
            <div>
              <h2>Ảnh bìa</h2>
              <p>Chọn ảnh và căn chỉnh trước khi lưu.</p>
            </div>
            <button
              className={styles.popoverClose}
              type="button"
              onClick={onCloseCoverEditor}
              aria-label="Đóng tùy chọn ảnh bìa"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <form className={styles.coverUrlForm} onSubmit={handleUrlSubmit} noValidate>
            <label htmlFor="cover-image-url">Dùng đường dẫn ảnh</label>
            <div className={styles.coverUrlRow}>
              <input
                id="cover-image-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/cover.jpg"
                value={coverUrl}
                autoFocus
                onChange={(event) => onCoverUrlChange?.(event.target.value)}
                disabled={isCoverBusy}
              />
              <button type="submit" disabled={isCoverBusy}>
                {isCoverBusy ? 'Đang tải…' : 'Áp dụng'}
              </button>
            </div>
            <p className={styles.coverPopoverHint}>Ảnh từ website ngoài cần cho phép CORS.</p>
          </form>

          <div
            className={styles.coverUploadChoice}
            role="button"
            tabIndex={0}
            aria-disabled={isCoverBusy}
            onClick={isCoverBusy ? undefined : onChooseCover}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            aria-label="Tải ảnh bìa từ thiết bị hoặc kéo thả ảnh vào đây"
          >
            <span className={styles.uploadMark} aria-hidden="true"><Upload size={17} /></span>
            <span><strong>Tải ảnh từ thiết bị</strong><small>Chọn hoặc kéo thả JPG, PNG, WebP · tối đa 5 MB</small></span>
          </div>

          {coverError ? <p className={styles.coverPopoverError} role="alert">{coverError}</p> : null}

          <footer className={styles.coverPopoverFooter}>
            {profile.coverImageUrl ? (
              <button
                className={styles.removeCover}
                type="button"
                onClick={onRemoveCover}
                disabled={isCoverBusy}
              >
                Xóa ảnh bìa
              </button>
            ) : <span />}
            <button
              className={styles.closeCover}
              type="button"
              onClick={onCloseCoverEditor}
            >
              Đóng
            </button>
          </footer>
        </section>
      ) : null}
      </div>

      <div className={styles.profileGrid}>
        <aside className={styles.sidebar}>
          <section className={styles.identityCard}>
            <UserAvatar
              source={avatarImage}
              username={profile.username}
              size="large"
              label={`Ảnh đại diện ${profile.displayName}`}
            />
            <h1>{profile.displayName}</h1>
            <p className={styles.username}>@{profile.username}</p>
            <p className={styles.joined}>Tham gia {Number.isNaN(joined.getTime()) ? '—' : joined.toLocaleDateString('vi-VN')}</p>
            {privateEmail ? <p className={styles.privateEmail}>{privateEmail}</p> : null}

            <dl className={styles.sideStats}>
              <div><dt>Bài đã giải</dt><dd>{profile.stats.solvedCount}</dd></div>
              <div><dt>Hạng điểm</dt><dd>{profile.stats.rank ? `#${profile.stats.rank}` : '—'}</dd></div>
              <div><dt>Tổng điểm</dt><dd>{profile.stats.cumulativePoints}</dd></div>
              <div><dt>Đóng góp</dt><dd>{profile.stats.contributionCount}</dd></div>
            </dl>
            {isOwner ? (
              <Link className={styles.primaryAction} to="/profile/edit">Chỉnh sửa hồ sơ</Link>
            ) : (
              <Link className={styles.primaryAction} to={`/submissions?userId=${encodeURIComponent(profile.id)}`}>Xem các bài nộp</Link>
            )}
            {isOwner ? <Link className={styles.secondaryAction} to={`/submissions?userId=${encodeURIComponent(profile.id)}`}>Xem các bài nộp</Link> : null}
          </section>

          <section className={styles.sidebarSection} aria-labelledby="contest-title">
            <h2 id="contest-title">Thống kê cuộc thi</h2>
            {profile.contestStatistics ? (
              <dl>
                <div><dt>Đã tham gia</dt><dd>{profile.contestStatistics.participated}</dd></div>
                <div><dt>Hạng rating</dt><dd>{profile.contestStatistics.highestRank ? `#${profile.contestStatistics.highestRank}` : '—'}</dd></div>
                <div><dt>Rating hiện tại</dt><dd>{profile.contestStatistics.currentRating ?? '—'}</dd></div>
                <div><dt>Thấp nhất</dt><dd>{profile.contestStatistics.lowestRating ?? '—'}</dd></div>
                <div><dt>Cao nhất</dt><dd>{profile.contestStatistics.highestRating ?? '—'}</dd></div>
                <div><dt>Danh hiệu</dt><dd>{profile.contestStatistics.titles.join(', ') || '—'}</dd></div>
              </dl>
            ) : <p className={styles.emptyState}>Chưa có dữ liệu cuộc thi.</p>}
          </section>
        </aside>

        <div className={styles.content}>
          <section className={styles.bioCard} aria-labelledby="bio-title">
            <header>
              <h2 id="bio-title">Về tôi</h2>
              {isOwner ? <Link to="/profile/edit">Chỉnh sửa</Link> : null}
            </header>
            <p>{profile.bio || 'Chưa có phần giới thiệu.'}</p>
            <p className={styles.education}>{profile.organization || 'Chưa cập nhật trường hoặc tổ chức.'}</p>
          </section>

          <ProfileActivityHeatmap activity={profile.activity} />

          <section className={styles.section} aria-labelledby="rating-title">
            <header className={styles.sectionHeader}><h2 id="rating-title">Tiến trình — Lịch sử rating</h2></header>
            {profile.ratingHistory.length > 1 ? (
              <svg className={styles.ratingPlot} viewBox="0 0 720 180" role="img" aria-label="Biểu đồ lịch sử rating">
                <polyline
                  points={profile.ratingHistory.map((point, index) => {
                    const x = index * (720 / (profile.ratingHistory.length - 1))
                    const values = profile.ratingHistory.map((item) => item.rating)
                    const min = Math.min(...values)
                    const max = Math.max(...values)
                    const y = 160 - ((point.rating - min) / Math.max(1, max - min)) * 140
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <p className={styles.emptyState}>Chưa có lịch sử rating. Biểu đồ sẽ xuất hiện khi có dữ liệu.</p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="achievements-title">
            <header className={styles.sectionHeader}><h2 id="achievements-title">Thành tích</h2></header>
            {profile.achievements.length ? (
              <ul className={styles.achievementList}>
                  {profile.achievements.map((achievement) => (
                    <li key={achievement.id}><strong>{achievement.name}</strong><time>{new Date(achievement.achievedAt).toLocaleDateString('vi-VN')}</time></li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>Chưa có thành tích được ghi nhận.</p>
            )}
          </section>

          <div className={styles.motto}>HỌC TẬP – CHIA SẺ – BỨT PHÁ</div>
        </div>
      </div>
      </div>
    </main>
  )
}

export default ProfileShowcase