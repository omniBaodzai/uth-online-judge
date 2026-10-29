import assert from 'node:assert/strict'
import test from 'node:test'
import { publicProfilePath, toProfileViewModel, type PublicProfile } from '../src/features/profile/api.ts'

const profile: PublicProfile = {
  user: {
    id: 'user-id',
    username: 'coder',
    displayName: 'Coder Name',
    avatarUrl: null,
    coverImageUrl: null,
    coverCrop: null,
    bio: null,
    organization: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  stats: { rank: null, solvedCount: 0, cumulativePoints: 0, submissionCount: 0, contributionCount: 0 },
  activity: [],
  ratingHistory: [],
  contestStatistics: null,
  achievements: [],
}

test('builds safe public-profile paths for username and id routes', () => {
  assert.equal(publicProfilePath({ username: 'a/b' }), '/users/a%2Fb')
  assert.equal(publicProfilePath({ userId: 'user-id' }), '/users/id/user-id')
})

test('maps API profile fields without inventing account or achievement data', () => {
  const view = toProfileViewModel(profile)
  assert.equal(view.displayName, 'Coder Name')
  assert.equal(view.organization, '')
  assert.deepEqual(view.stats, profile.stats)
  assert.equal(view.contestStatistics, null)
  assert.deepEqual(view.ratingHistory, [])
  assert.deepEqual(view.achievements, [])
})
