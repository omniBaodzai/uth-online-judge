import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLoginPath, getReturnPath, sanitizeReturnPath } from '../src/features/auth/return-path.ts'

test('buildLoginPath encodes the destination and round-trips through getReturnPath', () => {
  const login = buildLoginPath('/discussions/new?x=1#a')
  assert.equal(login, '/login?returnTo=%2Fdiscussions%2Fnew%3Fx%3D1%23a')
  assert.equal(getReturnPath(login.slice(login.indexOf('?'))), '/discussions/new?x=1#a')
})

test('returns to the discussion detail page after login', () => {
  const login = buildLoginPath('/discussions/42')
  assert.equal(getReturnPath(login.slice(login.indexOf('?'))), '/discussions/42')
})

test('sanitizeReturnPath rejects open-redirect attempts', () => {
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'discussions', '', null, undefined]) {
    assert.equal(sanitizeReturnPath(bad), '/', String(bad))
  }
})

test('getReturnPath falls back to home when returnTo is missing', () => {
  assert.equal(getReturnPath(''), '/')
})
