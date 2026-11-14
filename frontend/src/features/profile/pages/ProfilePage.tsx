import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FullscreenLoader } from '../../../components/ui/Loading'
import { useAuth } from '../../auth/useAuth'
import { RequireAuth } from '../../auth/components/RequireAuth'
import ProfileExperience from '../components/ProfileExperience'
import { toProfileViewModel } from '../api'
import { usePublicProfile } from '../usePublicProfile'
import styles from './ProfilePage.module.css'

function ProfilePage() {
  const { t } = useTranslation('pages')
  const { user, uploadCover, updateProfile } = useAuth()
  const { profile: result, loading, error } = usePublicProfile(
    user ? { userId: user.id } : {},
  )
  const profile = useMemo(() => result ? toProfileViewModel(result) : null, [result])

  return (
    <div className={styles.page}>
      <RequireAuth>
        {loading ? <FullscreenLoader label={t('loadingProfile')} /> : null}
        {error ? <p className={styles.feedback} role="alert">{error}</p> : null}
        {profile && user ? (
          <ProfileExperience
            profile={profile}
            isOwner
            privateEmail={user.email}
            onUploadCover={uploadCover}
            onRemoveCover={updateProfile}
          />
        ) : null}
      </RequireAuth>
    </div>
  )
}

export default ProfilePage
