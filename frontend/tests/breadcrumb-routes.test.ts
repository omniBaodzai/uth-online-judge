import assert from 'node:assert/strict'
import test from 'node:test'
import { getBreadcrumbItems } from '../src/components/navigation/breadcrumb-routes.ts'

test('builds meaningful breadcrumbs for a problem detail route', () => {
  assert.deepEqual(getBreadcrumbItems('/problems/UTH011'), [
    { label: 'Trang chủ', to: '/' },
    { label: 'Bài tập', to: '/problems' },
    { label: 'Chi tiết bài tập (UTH011)' },
  ])
})

test('includes the problem parent when composing the submit route', () => {
  assert.deepEqual(getBreadcrumbItems('/problems/UTH011/submit'), [
    { label: 'Trang chủ', to: '/' },
    { label: 'Bài tập', to: '/problems' },
    { label: 'Chi tiết bài tập (UTH011)', to: '/problems/UTH011' },
    { label: 'Gửi bài giải' },
  ])
})

test('builds the public problem submissions breadcrumb from the route code', () => {
  assert.deepEqual(getBreadcrumbItems('/problems/uth012/submissions'), [
    { label: 'Trang chủ', to: '/' },
    { label: 'Bài tập', to: '/problems' },
    { label: 'Chi tiết bài tập (uth012)', to: '/problems/uth012' },
    { label: 'Danh sách bài nộp' },
  ])
})

test('builds the submission details hierarchy from the submission problem code', () => {
  const path = '/submissions/253dfc57-c0cf-4305-8699-a3b3939d3d08'
  for (const code of ['uth012', 'abc99']) {
    const items = getBreadcrumbItems(path, { problemCode: code })
    assert.deepEqual(items.map(({ label, to }) => [label, to]), [
      ['Trang chủ', '/'],
      ['Bài tập', '/problems'],
      [`Chi tiết bài tập (${code})`, `/problems/${code}`],
      ['Gửi bài giải', `/problems/${code}/submit`],
      ['Chi tiết bài nộp', undefined],
    ])
  }
})

test('shows My Submissions as the parent when opened from that list', () => {
  const items = getBreadcrumbItems('/submissions/253dfc57-c0cf-4305-8699-a3b3939d3d08', {
    problemCode: 'uth012',
    from: 'my-submissions',
  })
  assert.deepEqual(items.map(({ label, to }) => [label, to]), [
    ['Trang chủ', '/'],
    ['Bài tập', '/problems'],
    ['Chi tiết bài tập (uth012)', '/problems/uth012'],
    ['Bài nộp của tôi', '/problems/uth012/submissions/me'],
    ['Chi tiết bài nộp', undefined],
  ])
})

test('falls back without a fake problem code while submission data is unavailable', () => {
  const items = getBreadcrumbItems('/submissions/invalid-id')
  assert.deepEqual(items.map(({ label }) => label), ['Trang chủ', 'Bài nộp', 'Chi tiết bài nộp'])
})

test('never exposes submission UUIDs in breadcrumb labels', () => {
  const items = getBreadcrumbItems('/submissions/253dfc57-c0cf-4305-8699-a3b3939d3d08')
  assert.deepEqual(items, [
    { label: 'Trang chủ', to: '/' },
    { label: 'Bài nộp', to: '/submissions' },
    { label: 'Chi tiết bài nộp' },
  ])
})

test('builds the nested admin breadcrumb without exposing database IDs', () => {
  assert.deepEqual(getBreadcrumbItems('/admin/problems/42/edit'), [
    { label: 'Admin', to: '/admin' },
    { label: 'Bài tập', to: '/admin/problems' },
    { label: 'Chỉnh sửa bài tập' },
  ])
})

test('omits breadcrumbs from shallow and authentication routes', () => {
  assert.deepEqual(getBreadcrumbItems('/'), [])
  assert.deepEqual(getBreadcrumbItems('/login'), [])
  assert.deepEqual(getBreadcrumbItems('/register'), [])
  assert.deepEqual(getBreadcrumbItems('/forgot-password'), [])
  assert.deepEqual(getBreadcrumbItems('/admin/login'), [])
})
