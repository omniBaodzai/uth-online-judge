import assert from 'node:assert/strict'
import test from 'node:test'
import { constrainCropOffset, getCropRect, getMaxCropOffset } from '../src/features/profile/crop-geometry.ts'

test('creates a centered 3.2:1 crop within the source image', () => {
  const crop = getCropRect({ width: 1600, height: 900 }, 1, 3.2, { x: 0, y: 0 })
  assert.deepEqual(crop, { x: 0, y: 200, width: 1600, height: 500 })
})

test('constrains wide-banner drag offsets and preserves aspect at zoom', () => {
  const source = { width: 1600, height: 900 }
  const max = getMaxCropOffset(source, 2, 3.2)
  const offset = constrainCropOffset(source, 2, 3.2, { x: 1, y: 5 })
  const crop = getCropRect(source, 2, 3.2, offset)

  assert.equal(offset.x, max.x)
  assert.equal(offset.y, max.y)
  assert.ok(crop.x >= 0 && crop.y >= 0)
  assert.ok(crop.x + crop.width <= source.width)
  assert.ok(crop.y + crop.height <= source.height)
  assert.ok(Math.abs(crop.width / crop.height - 3.2) < 0.001)
})

test('keeps square avatar crop geometry unchanged', () => {
  assert.deepEqual(
    getCropRect({ width: 1200, height: 800 }, 1, 1, { x: 0, y: 0 }),
    { x: 200, y: 0, width: 800, height: 800 },
  )
})