import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLeaderboardQuery } from '../src/features/leaderboard/api.ts'

test('builds a leaderboard query with trimmed, encoded search text', () => {
  assert.equal(
    buildLeaderboardQuery({ page: 2, pageSize: 20, q: '  Lê Bảo  ' }),
    '?page=2&pageSize=20&q=L%C3%AA+B%E1%BA%A3o',
  )
})

test('omits empty leaderboard search terms', () => {
  assert.equal(buildLeaderboardQuery({ page: 1, pageSize: 5, q: '   ' }), '?page=1&pageSize=5')
})