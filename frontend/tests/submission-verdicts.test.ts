import assert from 'node:assert/strict'
import test from 'node:test'
import { getSubmissionVerdictDistribution } from '../src/features/submissions/data/submission-verdicts.ts'

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
