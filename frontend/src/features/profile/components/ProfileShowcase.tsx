import type { DragEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
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
            {t('editCover')}
          </button>
        ) : null}
      </div>
      {isOwner && coverEditorOpen ? (
        <section
          className={styles.coverPopover}
          id="cover-editor-popover"
          role="dialog"
          aria-modal="false"
          aria-label={t('coverOptions')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCloseCoverEditor?.()
          }}
        >
          <header className={styles.coverPopoverHeader}>
            <div>
              <h2>{t('coverImage')}</h2>
              <p>{t('chooseCoverHint')}</p>
            </div>
            <button
              className={styles.popoverClose}
              type="button"
              onClick={onCloseCoverEditor}
              aria-label={t('closeCoverOptions')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <form className={styles.coverUrlForm} onSubmit={handleUrlSubmit} noValidate>
            <label htmlFor="cover-image-url">{t('useImageUrl')}</label>
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
                {isCoverBusy ? t('applying') : t('apply')}
              </button>
            </div>
            <p className={styles.coverPopoverHint}>{t('coverCorsHint')}</p>
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
            aria-label={t('uploadCoverLabel')}
          >
            <span className={styles.uploadMark} aria-hidden="true"><Upload size={17} /></span>
            <span><strong>{t('uploadImage')}</strong><small>{t('uploadImageHint')}</small></span>
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
                {t('removeCover')}
              </button>
            ) : <span />}
            <button
              className={styles.closeCover}
              type="button"
              onClick={onCloseCoverEditor}
            >
              {t('closeCover')}
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
              label={t('avatarAlt', { name: profile.displayName })}
            />
            <h1>{profile.displayName}</h1>
            <p className={styles.username}>@{profile.username}</p>
            <p className={styles.joined}>{t('joinedOn', { date: Number.isNaN(joined.getTime()) ? '—' : joined.toLocaleDateString(locale) })}</p>
            {privateEmail ? <p className={styles.privateEmail}>{privateEmail}</p> : null}

            <dl className={styles.sideStats}>
              <div><dt>{t('solvedProblems')}</dt><dd>{profile.stats.solvedCount.toLocaleString(locale)}</dd></div>
              <div><dt>{t('pointsRank')}</dt><dd>{profile.stats.rank ? `#${profile.stats.rank}` : '—'}</dd></div>
              <div><dt>{t('totalPoints')}</dt><dd>{profile.stats.cumulativePoints.toLocaleString(locale)}</dd></div>
              <div><dt>{t('contributions')}</dt><dd>{profile.stats.contributionCount.toLocaleString(locale)}</dd></div>
            </dl>
            {isOwner ? (
              <Link className={styles.primaryAction} to="/profile/edit">{t('editProfile')}</Link>
            ) : (
              <Link className={styles.primaryAction} to={`/submissions?userId=${encodeURIComponent(profile.id)}`}>{t('viewSubmissions')}</Link>
            )}
            {isOwner ? <Link className={styles.secondaryAction} to={`/submissions?userId=${encodeURIComponent(profile.id)}`}>{t('viewSubmissions')}</Link> : null}
          </section>

          <section className={styles.sidebarSection} aria-labelledby="contest-title">
            <h2 id="contest-title">{t('contestStatistics')}</h2>
            {profile.contestStatistics ? (
              <dl>
                <div><dt>{t('participated')}</dt><dd>{profile.contestStatistics.participated.toLocaleString(locale)}</dd></div>
                <div><dt>{t('ratingRank')}</dt><dd>{profile.contestStatistics.highestRank ? `#${profile.contestStatistics.highestRank}` : '—'}</dd></div>
                <div><dt>{t('currentRating')}</dt><dd>{profile.contestStatistics.currentRating ?? '—'}</dd></div>
                <div><dt>{t('lowestRating')}</dt><dd>{profile.contestStatistics.lowestRating ?? '—'}</dd></div>
                <div><dt>{t('highestRating')}</dt><dd>{profile.contestStatistics.highestRating ?? '—'}</dd></div>
                <div><dt>{t('titles')}</dt><dd>{profile.contestStatistics.titles.join(', ') || '—'}</dd></div>
              </dl>
            ) : <p className={styles.emptyState}>{t('noContestData')}</p>}
          </section>
        </aside>

        <div className={styles.content}>
          <section className={styles.bioCard} aria-labelledby="bio-title">
            <header>
              <h2 id="bio-title">{t('aboutMe')}</h2>
              {isOwner ? <Link to="/profile/edit">{t('edit')}</Link> : null}
            </header>
            <p>{profile.bio || t('noBio')}</p>
            <p className={styles.education}>{profile.organization || t('noOrganization')}</p>
          </section>

          <ProfileActivityHeatmap activity={profile.activity} />

          <section className={styles.section} aria-labelledby="rating-title">
            <header className={styles.sectionHeader}><h2 id="rating-title">{t('ratingHistory')}</h2></header>
            {profile.ratingHistory.length > 1 ? (
              <svg className={styles.ratingPlot} viewBox="0 0 720 180" role="img" aria-label={t('ratingChart')}>
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
              <p className={styles.emptyState}>{t('noRatingHistory')}</p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="achievements-title">
            <header className={styles.sectionHeader}><h2 id="achievements-title">{t('achievements')}</h2></header>
            {profile.achievements.length ? (
              <ul className={styles.achievementList}>
                  {profile.achievements.map((achievement) => (
                    <li key={achievement.id}><strong>{achievement.name}</strong><time>{new Date(achievement.achievedAt).toLocaleDateString(locale)}</time></li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>{t('noAchievementsRecorded')}</p>
            )}
          </section>

          <div className={styles.motto}>{t('profileMotto')}</div>
        </div>
      </div>
      </div>
    </main>
  )
}

export default ProfileShowcase