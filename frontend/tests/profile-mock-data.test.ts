import assert from 'node:assert/strict'
import test from 'node:test'
import { getMockProfileByUsername, getPersonalMockProfile } from '../src/features/profile/profile-mock-data.ts'

test('resolves public mock profiles by username without case sensitivity', () => {
  assert.equal(getMockProfileByUsername('HV1')?.username, 'hv1')
  assert.equal(getMockProfileByUsername('not-a-coder'), null)
})

test('includes zero-stat users and empty contest/rating states in the mock catalogue', () => {
  const profile = getMockProfileByUsername('test3')
  assert.ok(profile)
  assert.equal(profile.stats.solvedCount, 0)
  assert.equal(profile.stats.cumulativePoints, 0)
  assert.equal(profile.contestStatistics.participated, 0)
  assert.deepEqual(profile.ratingHistory, [])
  assert.deepEqual(profile.achievements, [])
})

test('uses the logged-in identity without using private auth fields as mock profile data', () => {
  const profile = getPersonalMockProfile({
    id: 'auth-user-id',
    username: 'hv1',
    email: 'private@real.test',
    full_name: 'Real Name',
    avatar_url: '/private-avatar.webp',
  } as never)
  assert.equal(profile.id, 'auth-user-id')
  assert.equal(profile.username, 'hv1')
  assert.equal(profile.displayName, 'hv1')
  assert.equal(profile.email, 'hv1@example.test')
  assert.equal(profile.avatarUrl, null)
})