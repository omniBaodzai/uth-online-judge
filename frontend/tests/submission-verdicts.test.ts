import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSubmissionVerdictDistribution,
  getSubmissionVerdictLegend,
} from '../src/features/submissions/data/submission-verdicts.ts'

test('legend keeps the six core verdicts and adds present extras consistent with the total', () => {
  const counts = { ACCEPTED: 3, WRONG_ANSWER: 1, QUEUED: 1, INTERNAL_ERROR: 1, MYSTERY: 2 }
  const legend = getSubmissionVerdictLegend(counts, 8)

  assert.deepEqual(
    legend.slice(0, 6).map((item) => item.abbr),
    ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'],
  )
  assert.deepEqual(legend.slice(6).map((item) => item.abbr), ['Q', 'IE', '?'])
  assert.equal(legend.reduce((sum, item) => sum + item.count, 0), 8)
  assert.equal(legend.find((item) => item.abbr === 'AC')?.percentage, 37.5)
  assert.equal(legend.find((item) => item.abbr === 'TLE')?.count, 0)
})

test('legend is all zero and never divides by zero for an empty dataset', () => {
  const legend = getSubmissionVerdictLegend({}, 0)
  assert.equal(legend.length, 6)
  assert.ok(legend.every((item) => item.count === 0 && item.percentage === 0))
  assert.deepEqual(getSubmissionVerdictDistribution({}, 0), [])
})

test('calculates verdict percentages from all submission totals', () => {
  const distribution = getSubmissionVerdictDistribution({
    ACCEPTED: 3,
    WRONG_ANSWER: 1,
    RUNNING: 1,
  }, 5)

  assert.deepEqual(distribution.map(({ status, count, percentage }) => ({
    status,
    count,
    percentage,
  })), [
    { status: 'ACCEPTED', count: 3, percentage: 60 },
    { status: 'WRONG_ANSWER', count: 1, percentage: 20 },
    { status: 'RUNNING', count: 1, percentage: 20 },
  ])
})

test('recognises Internal Error and rounds each share from the same counts', () => {
  const distribution = getSubmissionVerdictDistribution({
    ACCEPTED: 2,
    WRONG_ANSWER: 2,
    COMPILATION_ERROR: 1,
    INTERNAL_ERROR: 1,
  }, 6)

  assert.deepEqual(distribution.map((item) => [item.abbr, item.count, item.percentage.toFixed(1)]), [
    ['AC', 2, '33.3'],
    ['WA', 2, '33.3'],
    ['CE', 1, '16.7'],
    ['IE', 1, '16.7'],
  ])
})

test('keeps unknown statuses and uncounted submissions under "Khác"', () => {
  const unknown = getSubmissionVerdictDistribution({ ACCEPTED: 1, SOMETHING_NEW: 2 }, 4)
  assert.deepEqual(unknown.map(({ abbr, count }) => [abbr, count]), [['AC', 1], ['?', 3]])

  const missing = getSubmissionVerdictDistribution({}, 3)
  assert.deepEqual(missing.map(({ label, count }) => [label, count]), [['Khác', 3]])
})

test('returns an empty distribution for zero submissions', () => {
  assert.deepEqual(getSubmissionVerdictDistribution({}, 0), [])
})
