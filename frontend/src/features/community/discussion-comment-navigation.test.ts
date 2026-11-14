import { describe, expect, it, vi } from 'vitest'
import type { DiscussionComment, PageResult } from './api'
import {
  buildDiscussionCommentHref,
  discussionCommentElementId,
  locateDiscussionCommentPage,
} from './discussion-comment-navigation'

function comment(id: string, replies: DiscussionComment[] = []): DiscussionComment {
  return {
    id,
    discussionId: 'discussion-id',
    parentId: null,
    isDeleted: false,
    authorName: 'user',
    content: 'comment',
    createdAt: '',
    updatedAt: '',
    reactions: { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null },
    replies,
    canEdit: false,
    canDelete: false,
  }
}

describe('discussion comment notification navigation', () => {
  it('creates a refresh-safe deep link from notification metadata', () => {
    expect(buildDiscussionCommentHref({
      discussionId: 'thread/id',
      commentId: 'reply-id',
      rootCommentId: 'root-id',
    })).toBe('/discussions/thread%2Fid?commentId=reply-id&rootCommentId=root-id')
    expect(discussionCommentElementId('reply-id')).toBe('discussion-comment-reply-id')
  })

  it('finds the display page for a nested reply on a later root-comment page', async () => {
    const items = Array.from({ length: 50 }, (_, index) => comment(`root-${index + 1}`))
    items[21] = comment('root-22', [
      comment('reply-1', [comment('target-reply')]),
    ])
    const loadPage = vi.fn(async (_page: number, pageSize: number): Promise<PageResult<DiscussionComment>> => ({
      items: items.slice(0, pageSize),
      total: 50,
      page: 1,
      pageSize,
    }))

    await expect(locateDiscussionCommentPage(loadPage, 'target-reply', 'root-22')).resolves.toEqual({
      page: 2,
      targetFound: true,
      anchorCommentId: 'target-reply',
    })
    expect(loadPage).toHaveBeenCalledWith(1, 50)
  })

  it('returns the root page as a safe fallback when the reply was hard-deleted', async () => {
    const loadPage = vi.fn(async (): Promise<PageResult<DiscussionComment>> => ({
      items: [comment('root-id')],
      total: 1,
      page: 1,
      pageSize: 50,
    }))

    await expect(locateDiscussionCommentPage(loadPage, 'deleted-reply', 'root-id')).resolves.toEqual({
      page: 1,
      targetFound: false,
      anchorCommentId: 'root-id',
    })
  })

  it('returns no page when neither target nor root exists', async () => {
    const loadPage = vi.fn(async (): Promise<PageResult<DiscussionComment>> => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    }))

    await expect(locateDiscussionCommentPage(loadPage, 'deleted-comment', 'deleted-root')).resolves.toBeNull()
  })
})
