import type { DiscussionComment } from './api'
import { locateCommentPage, type CommentPageLoader, type LocatedComment } from './comment-navigation'

export const DISCUSSION_COMMENTS_PAGE_SIZE = 20
export type LocatedDiscussionComment = LocatedComment

export function buildDiscussionCommentHref(target: {
  discussionId: string
  commentId: string
  rootCommentId: string
}): string {
  const query = new URLSearchParams({
    commentId: target.commentId,
    rootCommentId: target.rootCommentId,
  })
  return `/discussions/${encodeURIComponent(target.discussionId)}?${query.toString()}`
}

export async function locateDiscussionCommentPage(
  loadPage: CommentPageLoader<DiscussionComment>,
  commentId: string,
  rootCommentId: string | null,
): Promise<LocatedDiscussionComment | null> {
  return locateCommentPage(loadPage, commentId, rootCommentId, DISCUSSION_COMMENTS_PAGE_SIZE)
}

export function discussionCommentElementId(commentId: string): string {
  return `discussion-comment-${commentId}`
}
