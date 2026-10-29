import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import ProfileExperience from '../components/ProfileExperience'
import { toProfileViewModel } from '../api'
import { usePublicProfile } from '../usePublicProfile'
import styles from './PublicProfilePage.module.css'

function PublicProfilePage() {
  const { username, id } = useParams()
  const { user, uploadCover, updateProfile } = useAuth()
  const { profile: result, loading, error, notFound } = usePublicProfile({
    username,
    userId: id,
  })

  if (loading) return <main className={styles.page} id="main-content" aria-live="polite"><p>Đang tải hồ sơ…</p></main>
  if (error || !result) {
    return (
      <main className={styles.page} id="main-content" role={notFound ? undefined : 'alert'}>
        <p>{notFound ? 'Không tìm thấy hồ sơ hoặc tài khoản đã ngừng hoạt động.' : error || 'Không thể tải hồ sơ.'}</p>
      </main>
    )
  }
  const profile = toProfileViewModel(result)
  const isOwner = user?.id === profile.id
  return (
    <ProfileExperience
      key={profile.id}
      profile={profile}
      isOwner={isOwner}
      privateEmail={isOwner ? user?.email : undefined}
      onUploadCover={uploadCover}
      onRemoveCover={updateProfile}
    />
  )
}

export default PublicProfilePage