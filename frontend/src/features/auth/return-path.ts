const FALLBACK_PATH = '/'
const PLACEHOLDER_ORIGIN = 'http://return-path.invalid'

// Chỉ chấp nhận đường dẫn nội bộ; mọi giá trị khác (URL ngoài, //host, \\) quay về trang chủ.
export function sanitizeReturnPath(requestedPath: string | null | undefined): string {
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//') || requestedPath.includes('\\')) {
    return FALLBACK_PATH
  }

  try {
    const destination = new URL(requestedPath, PLACEHOLDER_ORIGIN)
    return destination.origin === PLACEHOLDER_ORIGIN
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : FALLBACK_PATH
  } catch {
    return FALLBACK_PATH
  }
}

export function getReturnPath(search: string): string {
  return sanitizeReturnPath(new URLSearchParams(search).get('returnTo'))
}

export function buildLoginPath(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`
}
