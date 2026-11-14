import { describe, expect, it, vi } from 'vitest'
import type { PageResult } from './api'
import {
  buildProblemCommentHref,
  locateProblemCommentPage,
  problemCommentElementId,
} from './problem-comment-navigation'

type TestComment = { id: string; replies: TestComment[] }

function comment(id: string, replies: TestComment[] = []): TestComment {
  return { id, replies }
}

describe('problem comment notification navigation', () => {
  it('creates a refresh-safe deep link', () => {
    expect(buildProblemCommentHref({
      problemCode: 'problem/name',
      commentId: 'reply-id',
      rootCommentId: 'root-id',
    })).toBe('/problems/problem%2Fname?commentId=reply-id&rootCommentId=root-id')
    expect(problemCommentElementId('reply-id')).toBe('problem-comment-reply-id')
  })

  it('locates a nested reply on the correct paginated page', async () => {
    const items = Array.from({ length: 50 }, (_, index) => comment(`root-${index + 1}`))
    items[21] = comment('root-22', [comment('reply-1', [comment('target-reply')])])
    const loadPage = vi.fn(async (_page: number, pageSize: number): Promise<PageResult<TestComment>> => ({
      items: items.slice(0, pageSize),
      total: 50,
      page: 1,
      pageSize,
    }))

    await expect(locateProblemCommentPage(loadPage, 'target-reply', 'root-22')).resolves.toEqual({
      page: 3,
      targetFound: true,
      anchorCommentId: 'target-reply',
    })
    expect(loadPage).toHaveBeenCalledWith(1, 50)
  })

  it('falls back to the root when the replied-to comment was deleted', async () => {
    const loadPage = vi.fn(async (): Promise<PageResult<TestComment>> => ({
      items: [comment('root-id')],
      total: 1,
      page: 1,
      pageSize: 50,
    }))

    await expect(locateProblemCommentPage(loadPage, 'deleted-reply', 'root-id')).resolves.toEqual({
      page: 1,
      targetFound: false,
      anchorCommentId: 'root-id',
    })
  })

  it('returns no page when neither the target nor its root is available', async () => {
    const loadPage = vi.fn(async (): Promise<PageResult<TestComment>> => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    }))

    await expect(locateProblemCommentPage(loadPage, 'deleted-reply', 'deleted-root')).resolves.toBeNull()
  })
})
