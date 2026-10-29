import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ApiError, resolveAvatarUrl } from '../../auth/api'
import { useAuth } from '../../auth/useAuth'
import { useProblemsFetcher } from '../../problems/useProblemsFetcher'
import { fetchUserProfile, updateAbout, type UserProfile } from '../api'
import ContributionHeatmap from '../components/ContributionHeatmap'
import CoverPhoto from '../components/CoverPhoto'
import RatingChart from '../components/RatingChart'
import UserAvatar from '../components/UserAvatar'
import styles from './UserProfilePage.module.css'

type State =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; profile: UserProfile }

const dash = '—'

// Tên người dùng đứng đầu bảng xếp hạng được tô đỏ, nhóm đầu tô xanh lá.
function nameColor(rank: number | null): string {
  if (rank === 1) return '#d93025'
  if (rank !== null && rank <= 10) return '#1e8e3e'
  return 'var(--color-ink)'
}

export function ProfileRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.username) return <Navigate to="/profile/edit" replace />
  return <Navigate to={`/users/${encodeURIComponent(user.username)}`} replace />
}

function UserProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const { fetcher, ready } = useProblemsFetcher()
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setState({ phase: 'loading' })
    fetchUserProfile(fetcher, username)
      .then((profile) => {
        if (!cancelled) setState({ phase: 'ready', profile })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) setState({ phase: 'not-found' })
        else setState({ phase: 'error', message: error instanceof ApiError ? error.message : 'Không thể tải hồ sơ.' })
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, username, reloadKey])

  if (state.phase !== 'ready') {
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <section className={`${styles.card} ${styles.message}`} aria-busy={state.phase === 'loading'}>
            {state.phase === 'loading' && <p role="status">Đang tải hồ sơ…</p>}
            {state.phase === 'not-found' && (
              <>
                <h1>Không tìm thấy người dùng</h1>
                <Link className={styles.primaryButton} to="/">Về trang chủ</Link>
              </>
            )}
            {state.phase === 'error' && (
              <>
                <p role="alert">{state.message}</p>
                <button className={styles.primaryButton} type="button" onClick={() => setReloadKey((k) => k + 1)}>
                  Thử lại
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    )
  }

  const { profile } = state
  const isOwner = user?.username?.toLowerCase() === profile.username.toLowerCase()
  const avatar = resolveAvatarUrl(profile.avatarUrl)
  const displayName = profile.fullName || profile.username
  const color = nameColor(profile.rank)
  const joined = new Date(profile.createdAt).toLocaleDateString('vi-VN')
  const yearTotal = profile.heatmap.reduce((sum, item) => sum + item.count, 0)
  const contests = profile.contests

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        <CoverPhoto username={profile.username} canEdit={isOwner} />

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <section className={styles.card}>
              <div className={styles.profileTop}>
                <UserAvatar source={avatar} username={profile.username} size="large" />
                <h1 style={{ color }}>{displayName}</h1>
                <p className={styles.handle}>@{profile.username}</p>
                <p className={styles.muted}>Tham gia {joined}</p>
                {profile.email && <p className={styles.muted}>{profile.email}</p>}
              </div>
              <dl className={styles.quick}>
                <div><dt>Bài đã giải</dt><dd>{profile.solvedCount}</dd></div>
                <div><dt>Hạng điểm</dt><dd>{profile.rank === null ? dash : `#${profile.rank}`}</dd></div>
                <div><dt>Tổng điểm</dt><dd>{profile.totalScore}</dd></div>
                <div><dt>Đóng góp</dt><dd>{profile.contributions}</dd></div>
              </dl>
              <Link className={styles.primaryButton} to={`/submissions?q=${encodeURIComponent(profile.username)}`}>
                Xem các bài nộp →
              </Link>
              {isOwner && (
                <Link className={styles.secondaryButton} to="/profile/edit">Chỉnh sửa hồ sơ</Link>
              )}
            </section>

            <section className={styles.card} aria-labelledby="contest-stats">
              <h2 id="contest-stats" className={styles.cardTitle}>Thống kê cuộc thi</h2>
              <dl className={styles.rows}>
                <div><dt>Đã tham gia</dt><dd>{contests.attended} kỳ</dd></div>
                <div><dt>Hạng rating</dt><dd>{contests.rank === null ? dash : `#${contests.rank}`}</dd></div>
                <div><dt>Rating hiện tại</dt><dd>{contests.currentRating ?? dash}</dd></div>
                <div><dt>Thấp nhất</dt><dd>{contests.minRating ?? dash}</dd></div>
                <div><dt>Cao nhất</dt><dd>{contests.maxRating ?? dash}</dd></div>
                <div>
                  <dt>Danh hiệu</dt>
                  <dd>{contests.badgeTitle ? <span className={styles.badge}>{contests.badgeTitle}</span> : dash}</dd>
                </div>
              </dl>
            </section>
          </aside>

          <div className={styles.content}>
            <AboutCard profile={profile} isOwner={isOwner} onSaved={(bio, school) => setState({ phase: 'ready', profile: { ...profile, bio, school } })} />
            <section className={styles.card} aria-labelledby="activity-title">
              <div className={styles.cardHead}>
                <h2 id="activity-title" className={styles.cardTitle}>Hoạt động trong năm</h2>
                <span className={styles.muted}>{yearTotal} lượt nộp</span>
              </div>
              <ContributionHeatmap data={profile.heatmap} />
            </section>
            <RatingCard profile={profile} />
            <Banner />
          </div>
        </div>
      </div>
    </main>
  )
}

function RatingCard({ profile }: { profile: UserProfile }) {
  return (
    <section className={styles.card} aria-labelledby="rating-title">
      <h2 id="rating-title" className={styles.cardTitle}>Tiến trình — Lịch sử rating</h2>
      <RatingChart history={profile.ratingHistory} />
    </section>
  )
}

function Banner() {
  return (
    <section className={styles.banner} aria-label="Thông điệp cộng đồng">
      <strong>HỌC TẬP - CHIA SẺ - BỨT PHÁ</strong>
      <p>Mỗi bài giải là một bước tiến. Cùng cộng đồng UTH Online Judge chinh phục thử thách mới mỗi ngày.</p>
    </section>
  )
}

type AboutProps = { profile: UserProfile; isOwner: boolean; onSaved: (bio: string | null, school: string | null) => void }

function AboutCard({ profile, isOwner, onSaved }: AboutProps) {
  const { fetcher } = useProblemsFetcher()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [school, setSchool] = useState(profile.school ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await updateAbout(fetcher, { bio, school })
      onSaved(saved.bio, saved.school)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể lưu. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="about-title">
      <div className={styles.cardHead}>
        <h2 id="about-title" className={styles.cardTitle}>Về tôi</h2>
        {isOwner && !editing && (
          <button className={styles.linkButton} type="button" onClick={() => setEditing(true)}>Chỉnh sửa</button>
        )}
      </div>
      {editing ? (
        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="about-bio">Giới thiệu</label>
          <textarea id="about-bio" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
          <label htmlFor="about-school">Trường / Đơn vị</label>
          <input id="about-school" maxLength={150} value={school} onChange={(e) => setSchool(e.target.value)} />
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setEditing(false)}>Hủy</button>
            <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </form>
      ) : (
        <>
          {profile.bio ? <blockquote className={styles.bio}>{profile.bio}</blockquote> : <p className={styles.muted}>Chưa có giới thiệu.</p>}
          {profile.school && <p className={styles.school}>🎓 {profile.school}</p>}
        </>
      )}
    </section>
  )
}

export default UserProfilePage
