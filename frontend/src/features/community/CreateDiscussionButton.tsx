import { Link } from 'react-router-dom'
import { useToast } from '../../components/ui/toast-context'
import { decideGuestAction } from './guest-actions'
import { useCommunityRequest } from './api'

// Người đã đăng nhập đi thẳng tới trang tạo; khách nhận thông báo và ở lại trang hiện tại.
export function CreateDiscussionButton({ className }: { className: string }) {
  const { isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()

  if (isReady && isAuthenticated) {
    return <Link className={className} to="/discussions/new">+ Tạo thảo luận</Link>
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        const decision = decideGuestAction({ isReady, isAuthenticated }, 'create-discussion')
        if (decision.kind === 'toast') showToast(decision.message)
      }}
    >
      + Tạo thảo luận
    </button>
  )
}
