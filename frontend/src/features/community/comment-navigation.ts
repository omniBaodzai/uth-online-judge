import type { PageResult } from './api'

export type CommentNavigationNode = {
  id: string
  replies: CommentNavigationNode[]
}

export type CommentPageLoader<T extends CommentNavigationNode> = (
  page: number,
  pageSize: number,
) => Promise<PageResult<T>>

export type LocatedComment = {
  page: number
  targetFound: boolean
  anchorCommentId: string
}

const COMMENT_LOOKUP_PAGE_SIZE = 50

function containsComment(comments: CommentNavigationNode[], commentId: string): boolean {
  return comments.some((comment) =>
    comment.id === commentId || containsComment(comment.replies, commentId),
  )
}

export async function locateCommentPage<T extends CommentNavigationNode>(
  loadPage: CommentPageLoader<T>,
  commentId: string,
  rootCommentId: string | null,
  displayPageSize: number,
): Promise<LocatedComment | null> {
  const firstPage = await loadPage(1, COMMENT_LOOKUP_PAGE_SIZE)
  const pages = Math.ceil(firstPage.total / COMMENT_LOOKUP_PAGE_SIZE)

  for (let page = 1; page <= pages; page += 1) {
    const result = page === 1 ? firstPage : await loadPage(page, COMMENT_LOOKUP_PAGE_SIZE)
    const rootIndex = result.items.findIndex((root) =>
      root.id === rootCommentId || containsComment([root], commentId),
    )
    if (rootIndex < 0) continue

    const root = result.items[rootIndex]
    if (!root) continue
    const targetFound = containsComment([root], commentId)
    const rootPosition = (page - 1) * COMMENT_LOOKUP_PAGE_SIZE + rootIndex
    return {
      page: Math.floor(rootPosition / displayPageSize) + 1,
      targetFound,
      anchorCommentId: targetFound ? commentId : root.id,
    }
  }

  return null
}
