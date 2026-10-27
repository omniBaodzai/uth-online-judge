import assert from 'node:assert/strict'
import test from 'node:test'
import { describeSubmissionFailure } from '../src/features/problems/submit/submission-failure.ts'

test('explains that an uncertain 503 submission was saved and provides its id', () => {
  const error = Object.assign(
    new Error(
      'Bài nộp đã được lưu nhưng chưa xác nhận được hàng đợi chấm. Hệ thống sẽ tự phục hồi; vui lòng kiểm tra trạng thái bài nộp trước khi gửi lại.',
    ),
    { status: 503, submissionId: 'submission-1' },
  )
  const failure = describeSubmissionFailure(
    error,
  )

  assert.equal(failure.submissionId, 'submission-1')
  assert.match(failure.message, /đã được lưu/)
  assert.match(failure.message, /trước khi gửi lại/)
})

test('does not encourage resubmission when the HTTP response was not received', () => {
  const failure = describeSubmissionFailure(Object.assign(new Error('Network error'), { status: 0 }))

  assert.equal(failure.submissionId, undefined)
  assert.match(failure.message, /có thể đã được lưu/)
  assert.match(failure.message, /trước khi gửi lại/)
})

test('preserves a known validation error', () => {
  const failure = describeSubmissionFailure(
    Object.assign(new Error('Ngôn ngữ không hợp lệ.'), { status: 400 }),
  )

  assert.equal(failure.message, 'Ngôn ngữ không hợp lệ.')
})
