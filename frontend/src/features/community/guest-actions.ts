export type GuestAction = 'create-discussion' | 'comment' | 'reply' | 'react'

export const GUEST_MESSAGES: Record<GuestAction, string> = {
  'create-discussion': 'Bạn cần đăng nhập để tạo thảo luận.',
  comment: 'Bạn cần đăng nhập để bình luận.',
  reply: 'Bạn cần đăng nhập để trả lời bình luận.',
  react: 'Bạn cần đăng nhập để bày tỏ cảm xúc.',
}

export type GuestDecision = { kind: 'proceed' } | { kind: 'wait' } | { kind: 'toast'; message: string }

// Trạng thái xác thực chưa sẵn sàng thì không kết luận là khách, tránh báo nhầm khi đang khôi phục phiên.
export function decideGuestAction(
  auth: { isReady: boolean; isAuthenticated: boolean },
  action: GuestAction,
): GuestDecision {
  if (!auth.isReady) return { kind: 'wait' }
  if (auth.isAuthenticated) return { kind: 'proceed' }
  return { kind: 'toast', message: GUEST_MESSAGES[action] }
}
