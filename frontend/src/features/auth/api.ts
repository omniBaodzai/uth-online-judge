export type AuthUser = {
  id: string
  username: string | null
  email: string
  full_name: string | null
  avatar_url: string | null
  cover_image_url: string | null
  cover_crop: {
    x: number
    y: number
    width: number
    height: number
    sourceWidth: number
    sourceHeight: number
    aspect: number
  } | null
  bio: string | null
  organization: string | null
  is_active: boolean
  role: 'STUDENT' | 'ADMIN'
  created_at: string
  updated_at: string
}

export type AuthResponse = {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

type RefreshResponse = AuthResponse

export class ApiError extends Error {
  readonly status: number
  readonly submissionId?: string

  constructor(message: string, status: number, submissionId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.submissionId = submissionId
  }
}

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
let refreshInFlight: Promise<RefreshResponse> | null = null

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null
  try {
    const url = new URL(avatarUrl, `${apiBaseUrl}/`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function register(input: {
  username: string
  email: string
  password: string
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function login(input: {
  identifier: string
  password: string
  rememberMe: boolean
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function refresh(): Promise<RefreshResponse> {
  if (!refreshInFlight) {
    refreshInFlight = request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
    }).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}

export async function getProfileWithRefresh(
  accessToken: string,
  onRefresh: (nextAccessToken: string) => void,
): Promise<AuthUser> {
  return requestProtected<AuthUser>('/auth/me', accessToken, onRefresh)
}

export async function updateProfileWithRefresh(
  input: {
    fullName?: string | null
    avatarUrl?: string | null
    coverImageUrl?: string | null
    bio?: string | null
    organization?: string | null
  },
  accessToken: string,
  onRefresh: (nextAccessToken: string) => void,
): Promise<AuthUser> {
  return requestProtected<AuthUser>('/auth/me', accessToken, onRefresh, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function uploadCoverWithRefresh(
  file: File,
  crop: {
    x: number
    y: number
    width: number
    height: number
    sourceWidth: number
    sourceHeight: number
    aspect: number
  },
  accessToken: string,
  onRefresh: (nextAccessToken: string) => void,
): Promise<AuthUser> {
  const body = new FormData()
  body.append('cover', file, file.name)
  body.append('crop', JSON.stringify(crop))
  return requestProtected<AuthUser>('/auth/me/cover', accessToken, onRefresh, {
    method: 'POST',
    body,
  })
}

export async function uploadAvatarWithRefresh(
  file: File,
  fullName: string | null,
  accessToken: string,
  onRefresh: (nextAccessToken: string) => void,
): Promise<AuthUser> {
  const body = new FormData()
  body.append('avatar', file, file.name)
  if (fullName !== null) body.append('fullName', fullName)
  return requestProtected<AuthUser>('/auth/me/avatar', accessToken, onRefresh, {
    method: 'POST',
    body,
  })
}

export async function requestProtected<T>(
  path: string,
  accessToken: string,
  onRefresh: (nextAccessToken: string) => void,
  init: RequestInit = {},
): Promise<T> {
  try {
    return await request<T>(path, {
      ...init,
      headers: withAuthorization(init.headers, accessToken),
    })
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error

    const refreshed = await refresh()
    onRefresh(refreshed.accessToken)
    return request<T>(path, {
      ...init,
      headers: withAuthorization(init.headers, refreshed.accessToken),
    })
  }
}

function withAuthorization(headers: HeadersInit | undefined, accessToken: string): Headers {
  const nextHeaders = new Headers(headers)
  nextHeaders.set('Authorization', ['Bearer', accessToken].join(' '))
  return nextHeaders
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const headers = new Headers(init.headers)
    if (typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
  } catch {
    throw new ApiError('Không thể kết nối máy chủ. Vui lòng thử lại.', 0)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[]; submissionId?: string }
      | null
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : body?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'
    throw new ApiError(
      message,
      response.status,
      typeof body?.submissionId === 'string' ? body.submissionId : undefined,
    )
  }

  if (response.status === 204) return undefined as T
  // Một số endpoint ghi (ví dụ tạo bình luận) trả 201 không có body.
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
