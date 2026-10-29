export type ReactionType = 'LIKE' | 'LOVE' | 'HELPFUL'

export type ReactionSummary = {
  counts: Record<ReactionType, number>
  mine: ReactionType | null
}

export const REACTION_OPTIONS: { type: ReactionType; label: string }[] = [
  { type: 'LIKE', label: 'Thích' },
  { type: 'LOVE', label: 'Yêu thích' },
  { type: 'HELPFUL', label: 'Hữu ích' },
]

export const EMPTY_REACTIONS: ReactionSummary = { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null }

// Bấm lại đúng loại đang chọn thì bỏ cảm xúc; bấm loại khác thì đổi.
export function nextReaction(current: ReactionType | null, clicked: ReactionType): ReactionType | null {
  return current === clicked ? null : clicked
}

export function totalReactions(summary: ReactionSummary): number {
  return summary.counts.LIKE + summary.counts.LOVE + summary.counts.HELPFUL
}
