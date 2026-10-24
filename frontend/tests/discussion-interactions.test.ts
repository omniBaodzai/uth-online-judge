import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GUEST_MESSAGES, decideGuestAction } from '../src/features/community/guest-actions.ts'
import { EMPTY_REACTIONS, nextReaction, totalReactions } from '../src/features/community/reactions.ts'
import { mapDiscussion } from '../src/features/community/feed.ts'

describe('guest action decision', () => {
  it('waits while auth is loading', () => {
    assert.deepEqual(decideGuestAction({ isReady: false, isAuthenticated: false }, 'react'), { kind: 'wait' })
  })

  it('lets authenticated users proceed', () => {
    assert.deepEqual(decideGuestAction({ isReady: true, isAuthenticated: true }, 'reply'), { kind: 'proceed' })
  })

  it('shows a specific toast for guests', () => {
    for (const action of ['create-discussion', 'comment', 'reply', 'react'] as const) {
      assert.deepEqual(decideGuestAction({ isReady: true, isAuthenticated: false }, action), {
        kind: 'toast',
        message: GUEST_MESSAGES[action],
      })
    }
    assert.equal(GUEST_MESSAGES['create-discussion'], 'Bạn cần đăng nhập để tạo thảo luận.')
    assert.equal(GUEST_MESSAGES.reply, 'Bạn cần đăng nhập để trả lời bình luận.')
  })
})

describe('reaction toggling', () => {
  it('selects, changes and removes a reaction', () => {
    assert.equal(nextReaction(null, 'LIKE'), 'LIKE')
    assert.equal(nextReaction('LIKE', 'LOVE'), 'LOVE')
    assert.equal(nextReaction('LOVE', 'LOVE'), null)
  })

  it('sums reaction counts', () => {
    assert.equal(totalReactions(EMPTY_REACTIONS), 0)
    assert.equal(totalReactions({ counts: { LIKE: 2, LOVE: 1, HELPFUL: 3 }, mine: null }), 6)
  })
})

describe('discussion feed mapping', () => {
  it('carries the reaction count', () => {
    const entry = mapDiscussion({
      id: 'd1', title: 't', summary: 's', authorName: 'a', createdAt: '2025-01-01T00:00:00Z',
      replies: 2, reactionCount: 5, isLocked: false,
    })
    assert.equal(entry.reactions, 5)
    assert.equal(entry.to, '/discussions/d1')
  })
})
