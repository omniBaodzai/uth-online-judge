import { useCallback, useState } from 'react'

export type CommentReplyController = {
  activeCommentId: string | null
  focusOffset: number
  startReply: (commentId: string, username: string | null) => void
  getDraft: (commentId: string) => string
  updateDraft: (commentId: string, value: string) => void
  cancelReply: (commentId: string) => void
  completeReply: (commentId: string) => void
}

export function useCommentReply(): CommentReplyController {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [focusOffset, setFocusOffset] = useState(0)

  const startReply = useCallback((commentId: string, username: string | null) => {
    const hasDraft = Object.hasOwn(drafts, commentId)
    const nextDraft = hasDraft
      ? drafts[commentId] ?? ''
      : username
        ? `@${username} `
        : ''
    setDrafts((current) => hasDraft ? current : { ...current, [commentId]: nextDraft })
    setFocusOffset(nextDraft.length)
    setActiveCommentId(commentId)
  }, [drafts])

  const getDraft = useCallback((commentId: string) => drafts[commentId] ?? '', [drafts])

  const updateDraft = useCallback((commentId: string, value: string) => {
    setDrafts((current) => ({ ...current, [commentId]: value }))
  }, [])

  const cancelReply = useCallback((commentId: string) => {
    setActiveCommentId((current) => current === commentId ? null : current)
  }, [])

  const completeReply = useCallback((commentId: string) => {
    setDrafts((current) => {
      const remaining = { ...current }
      delete remaining[commentId]
      return remaining
    })
    setActiveCommentId((current) => current === commentId ? null : current)
  }, [])

  return {
    activeCommentId,
    focusOffset,
    startReply,
    getDraft,
    updateDraft,
    cancelReply,
    completeReply,
  }
}
