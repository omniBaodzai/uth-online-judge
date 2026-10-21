import { createContext } from 'react'
import type { AuthUser } from './api'

export type AuthContextValue = {
  accessToken: string | null
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  initializationError: string | null
  retrySession: () => Promise<void>
  login: (identifier: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (input: { fullName: string | null; avatarUrl: string | null }) => Promise<void>
  request: <T>(path: string) => Promise<T>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
