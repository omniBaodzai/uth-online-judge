import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupportedAvatarUrl } from '../src/features/profile/avatar-constants.ts'

test('accepts absolute HTTP and HTTPS avatar URLs', () => {
  assert.equal(isSupportedAvatarUrl('https://images.example.com/avatar.webp'), true)
  assert.equal(isSupportedAvatarUrl('http://localhost:3000/avatar.png'), true)
})

test('rejects non-web protocols, malformed URLs, and embedded credentials', () => {
  assert.equal(isSupportedAvatarUrl('javascript:alert(1)'), false)
  assert.equal(isSupportedAvatarUrl('data:image/png;base64,abc'), false)
  assert.equal(isSupportedAvatarUrl('/avatar.png'), false)
  assert.equal(isSupportedAvatarUrl('https://user:pass@example.com/avatar.png'), false)
})
