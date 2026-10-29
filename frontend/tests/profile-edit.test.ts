import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProfileUpdate } from '../src/features/profile/profile-edit.ts'

const initial = {
  fullName: 'Coder Name',
  bio: 'Hello',
  organization: 'UTH',
}

test('includes only the display name when only the name changed', () => {
  assert.deepEqual(
    buildProfileUpdate(initial, { ...initial, fullName: 'New Name' }),
    { fullName: 'New Name' },
  )
})

test('does not send profile fields when only an avatar is staged', () => {
  assert.deepEqual(buildProfileUpdate(initial, initial), {})
})

test('includes all and only changed text fields in a combined update', () => {
  assert.deepEqual(
    buildProfileUpdate(initial, {
      fullName: 'New Name',
      bio: 'Updated bio',
      organization: initial.organization,
    }),
    { fullName: 'New Name', bio: 'Updated bio' },
  )
})

test('uses null only when a changed field is intentionally cleared', () => {
  assert.deepEqual(
    buildProfileUpdate(initial, { ...initial, bio: '   ' }),
    { bio: null },
  )
})
