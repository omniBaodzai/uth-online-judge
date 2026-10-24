import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMemoryMiB } from '../src/features/submissions/submission-metrics.ts'

test('converts Judge0 kilobytes to binary mebibytes without changing the source unit', () => {
  assert.equal(formatMemoryMiB(12_152, 2), '11.87 MiB')
  assert.equal(formatMemoryMiB(12_152), '11.9 MiB')
  assert.equal(formatMemoryMiB(1024, 2), '1.00 MiB')
})

test('renders null and non-finite memory measurements as unavailable', () => {
  assert.equal(formatMemoryMiB(null), '—')
  assert.equal(formatMemoryMiB(Number.NaN), '—')
  assert.equal(formatMemoryMiB(Number.POSITIVE_INFINITY), '—')
})
