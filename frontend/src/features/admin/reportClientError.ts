import { apiBaseUrl } from '../auth/api'

let sent = 0

/** Gửi lỗi giao diện về backend (giới hạn số lượng mỗi phiên để tránh spam). */
export function reportClientError(message: string, stack?: string) {
  if (sent >= 10 || !message) return
  sent += 1
  void fetch(`${apiBaseUrl}/api/logs/client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      path: window.location.pathname,
    }),
    keepalive: true,
  }).catch(() => undefined)
}
