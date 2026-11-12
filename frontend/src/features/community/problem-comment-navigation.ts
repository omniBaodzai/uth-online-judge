import {
  locateCommentPage,
  type CommentNavigationNode,
  type CommentPageLoader,
  type LocatedComment,
} from './comment-navigation'

export const PROBLEM_COMMENTS_PAGE_SIZE = 10

export function buildProblemCommentHref(target: {
  problemCode: string
  commentId: string
  rootCommentId: string
}): string {
  const query = new URLSearchParams({
    commentId: target.commentId,
    rootCommentId: target.rootCommentId,
  })
  return `/problems/${encodeURIComponent(target.problemCode)}?${query.toString()}`
}

export function locateProblemCommentPage<T extends CommentNavigationNode>(
  loadPage: CommentPageLoader<T>,
  commentId: string,
  rootCommentId: string | null,
): Promise<LocatedComment | null> {
  return locateCommentPage(loadPage, commentId, rootCommentId, PROBLEM_COMMENTS_PAGE_SIZE)
}

export function problemCommentElementId(commentId: string): string {
  return `problem-comment-${commentId}`
}
