import { describe, expect, it } from 'vitest'
import { ApiError } from '../../auth/api'
import { contestErrorMessage, hasUncertainCreateOutcome } from './contest-errors'

describe('contest errors', () => {
  it('explains that a started contest keeps its previously saved data', () => {
    const error = new ApiError(
      'Không thể thay đổi bài tập sau khi cuộc thi bắt đầu.',
      409,
    )

    expect(contestErrorMessage(error, 'fallback')).toContain('Cuộc thi đã bắt đầu')
    expect(contestErrorMessage(error, 'fallback')).toContain('được giữ nguyên')
  })

  it('maps a publish time-window rejection to an actionable message', () => {
    const error = new ApiError(
      'Chỉ có thể xuất bản cuộc thi có thời gian kết thúc trong tương lai và chưa bắt đầu.',
      400,
    )

    expect(contestErrorMessage(error, 'fallback')).toContain('thời gian bắt đầu')
    expect(contestErrorMessage(error, 'fallback')).toContain('trong tương lai')
  })

  it.each([0, 500, 503])('treats status %i as an uncertain create outcome', (status) => {
    expect(hasUncertainCreateOutcome(new ApiError('Request failed', status))).toBe(true)
  })

  it('does not classify a definite client error as uncertain', () => {
    expect(hasUncertainCreateOutcome(new ApiError('Invalid input', 400))).toBe(false)
  })
})
