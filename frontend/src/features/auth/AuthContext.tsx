import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from './api'
import type { AuthUser } from './api'
import { AuthContext, type ProfileUpdate } from './auth-context'

type Credentials = {
  accessToken: string
  user: AuthUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const authRevision = useRef(0)

  const acceptCredentials = useCallback(({ accessToken: token, user: nextUser }: Credentials) => {
    setAccessToken(token)
    setUser(nextUser)
    setInitializationError(null)
  }, [])

  const restoreSession = useCallback(async (showLoading: boolean) => {
    const revision = ++authRevision.current
    if (showLoading) {
      setIsLoading(true)
      setInitializationError(null)
    }
    try {
      const refreshed = await authApi.refresh()
      if (revision === authRevision.current) acceptCredentials(refreshed)
    } catch (error) {
      if (revision === authRevision.current) {
        if (error instanceof authApi.ApiError && error.status === 401) {
          setAccessToken(null)
          setUser(null)
          setInitializationError(null)
        } else {
          setInitializationError(
            error instanceof Error ? error.message : 'Không thể kiểm tra phiên đăng nhập.',
          )
        }
      }
    } finally {
      if (revision === authRevision.current && showLoading) setIsLoading(false)
    }
  }, [acceptCredentials])

  const retrySession = useCallback(async () => {
    await restoreSession(true)
  }, [restoreSession])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void restoreSession(true)
    })
    return () => {
      active = false
    }
  }, [restoreSession])

  const login = useCallback(async (identifier: string, password: string, rememberMe: boolean) => {
    const revision = ++authRevision.current
    try {
      const credentials = await authApi.login({ identifier, password, rememberMe })
      if (revision === authRevision.current) acceptCredentials(credentials)
      return credentials.user
    } finally {
      if (revision === authRevision.current) setIsLoading(false)
    }
  }, [acceptCredentials])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const revision = ++authRevision.current
    try {
      const credentials = await authApi.register({ username, email, password })
      if (revision === authRevision.current) acceptCredentials(credentials)
    } finally {
      if (revision === authRevision.current) setIsLoading(false)
    }
  }, [acceptCredentials])

  const logout = useCallback(async () => {
    const previousCredentials = accessToken && user ? { accessToken, user } : null
    const revision = ++authRevision.current
    setAccessToken(null)
    setUser(null)
    setInitializationError(null)
    try {
      await authApi.logout()
    } catch (error) {
      if (revision === authRevision.current && previousCredentials) {
        acceptCredentials(previousCredentials)
      }
      throw error
    }
  }, [accessToken, acceptCredentials, user])

  const refreshProfile = useCallback(async () => {
    if (!accessToken) throw new authApi.ApiError('Vui lòng đăng nhập để tiếp tục.', 401)
    const revision = authRevision.current
    try {
      const profile = await authApi.getProfileWithRefresh(accessToken, (token) => {
        if (revision === authRevision.current) setAccessToken(token)
      })
      if (revision === authRevision.current) setUser(profile)
    } catch (error) {
      if (revision === authRevision.current && error instanceof authApi.ApiError && error.status === 401) {
        setAccessToken(null)
        setUser(null)
      }
      throw error
    }
  }, [accessToken])

  const updateProfile = useCallback(
    async (input: ProfileUpdate) => {
      if (!accessToken) throw new authApi.ApiError('Vui lòng đăng nhập để tiếp tục.', 401)
      const revision = authRevision.current
      try {
        const profile = await authApi.updateProfileWithRefresh(
          input,
          accessToken,
          (token) => {
            if (revision === authRevision.current) setAccessToken(token)
          },
        )
        if (revision === authRevision.current) setUser(profile)
        return profile
      } catch (error) {
        if (revision === authRevision.current && error instanceof authApi.ApiError && error.status === 401) {
          setAccessToken(null)
          setUser(null)
        }
        throw error
      }
    },
    [accessToken],
  )

  const uploadAvatar = useCallback(
    async (file: File, fullName: string | null) => {
      if (!accessToken) throw new authApi.ApiError('Vui lòng đăng nhập để tiếp tục.', 401)
      const revision = authRevision.current
      try {
        const profile = await authApi.uploadAvatarWithRefresh(
          file,
          fullName,
          accessToken,
          (token) => {
            if (revision === authRevision.current) setAccessToken(token)
          },
        )
        if (revision === authRevision.current) setUser(profile)
        return profile
      } catch (error) {
        if (revision === authRevision.current && error instanceof authApi.ApiError && error.status === 401) {
          setAccessToken(null)
          setUser(null)
        }
        throw error
      }
    },
    [accessToken],
  )

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!accessToken) throw new authApi.ApiError('Vui lòng đăng nhập để tiếp tục.', 401)
    const revision = authRevision.current
    try {
      return await authApi.requestProtected<T>(path, accessToken, (token) => {
        if (revision === authRevision.current) setAccessToken(token)
      }, init)
    } catch (error) {
      if (revision === authRevision.current && error instanceof authApi.ApiError && error.status === 401) {
        setAccessToken(null)
        setUser(null)
      }
      throw error
    }
  }, [accessToken])

  const value = useMemo(
    () => ({
      accessToken,
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      initializationError,
      retrySession,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      uploadAvatar,
      request,
    }),
    [
      accessToken,
      user,
      isLoading,
      initializationError,
      retrySession,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      uploadAvatar,
      request,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
