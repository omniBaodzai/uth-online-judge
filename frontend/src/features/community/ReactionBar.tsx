import { useRef, useState } from 'react'
import { Heart, Lightbulb, ThumbsUp, type LucideIcon } from 'lucide-react'
import { useToast } from '../../components/ui/toast-context'
import { decideGuestAction } from './guest-actions'
import { REACTION_OPTIONS, nextReaction, type ReactionSummary, type ReactionType } from './reactions'
import { useCommunityRequest } from './api'
import { errorMessage } from './useAsync'
import styles from './community.module.css'

const ICONS: Record<ReactionType, LucideIcon> = { LIKE: ThumbsUp, LOVE: Heart, HELPFUL: Lightbulb }

type ReactionBarProps = {
  summary: ReactionSummary
  // Đường dẫn endpoint reaction, ví dụ /discussions/:id/reaction
  path: string
  small?: boolean
}

export function ReactionBar({ summary, path, small = false }: ReactionBarProps) {
  const { request, isReady, isAuthenticated } = useCommunityRequest()
  const { showToast } = useToast()
  const [local, setLocal] = useState<{ base: ReactionSummary; value: ReactionSummary } | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  // Dùng kết quả máy chủ trả về cho đến khi dữ liệu cha được tải lại.
  const shown = local && local.base === summary ? local.value : summary

  async function click(type: ReactionSummary['mine'] & string) {
    const decision = decideGuestAction({ isReady, isAuthenticated }, 'react')
    if (decision.kind === 'wait') return
    if (decision.kind === 'toast') {
      showToast(decision.message)
      return
    }
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    try {
      const target = nextReaction(shown.mine, type)
      const value = await request<ReactionSummary>(path, {
        method: target ? 'PUT' : 'DELETE',
        body: target ? JSON.stringify({ type: target }) : undefined,
      })
      setLocal({ base: summary, value })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  return (
    <div className={styles.reactionWrap}>
      <div className={styles.reactions} role="group" aria-label="Cảm xúc">
        {REACTION_OPTIONS.map(({ type, label }) => {
          const Icon = ICONS[type]
          const active = shown.mine === type
          const count = shown.counts[type]
          return (
            <button
              key={type}
              type="button"
              className={`${styles.reactionButton} ${small ? styles.reactionSmall : ''} ${active ? styles.reactionActive : ''}`}
              aria-pressed={active}
              aria-label={`${label}, ${count} lượt`}
              disabled={pending}
              onClick={() => void click(type)}
            >
              <Icon size={small ? 14 : 16} strokeWidth={2} fill={active ? 'currentColor' : 'none'} fillOpacity={0.18} aria-hidden="true" />
              <span>{label}</span>
              <span className={styles.reactionCount}>{count}</span>
            </button>
          )
        })}
      </div>
      {error ? <span className={styles.error} role="alert">{error}</span> : null}
    </div>
  )
}
