import { useEffect, useState } from 'react'
import { ApiError, request as publicRequest } from '../auth/api'
import { fetchPublicProfile, type PublicProfile } from './api'

type ProfileIdentity = { username?: string; userId?: string }

export function usePublicProfile(identity: ProfileIdentity) {
  const username = identity.username
  const userId = identity.userId
  const hasIdentity = Boolean(username || userId)
  const key = username ?? userId ?? ''
  const [state, setState] = useState<{
    key: string
    profile: PublicProfile | null
    error: string
    notFound: boolean
  } | null>(null)

  useEffect(() => {
    if (!hasIdentity) return
    let active = true
    void fetchPublicProfile(publicRequest, { username, userId })
      .then((profile) => {
        if (active) setState({ key, profile, error: '', notFound: false })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          key,
          profile: null,
          error: error instanceof Error ? error.message : 'Không thể tải hồ sơ. Vui lòng thử lại.',
          notFound: error instanceof ApiError && error.status === 404,
        })
      })
    return () => { active = false }
  }, [hasIdentity, key, userId, username])

  const current = state?.key === key
  return {
    profile: current ? state.profile : null,
    loading: hasIdentity && !current,
    error: current ? state.error : '',
    notFound: current ? state.notFound : false,
  }
}