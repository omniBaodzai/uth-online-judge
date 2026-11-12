import { createContext } from 'react'
import type { AuthUser } from './api'

export type ProfileUpdate = {
  fullName?: string | null
  avatarUrl?: string | null
  coverImageUrl?: string | null
  bio?: string | null
  organization?: string | null
}

export type CoverCrop = {
  x: number
  y: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  aspect: number
}

export type AuthContextValue = {
  accessToken: string | null
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  initializationError: string | null
  retrySession: () => Promise<void>
  login: (identifier: string, password: string, rememberMe: boolean) => Promise<AuthUser>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (input: ProfileUpdate) => Promise<AuthUser>
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>
  completePasswordSetup: (input: { setupToken: string; newPassword: string }) => Promise<void>
  uploadAvatar: (file: File, fullName: string | null) => Promise<AuthUser>
  uploadCover: (file: File, crop: CoverCrop) => Promise<AuthUser>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  requestBlob: (path: string, init?: RequestInit) => Promise<Blob>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
