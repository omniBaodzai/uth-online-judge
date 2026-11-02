import { useEffect, useState } from 'react'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { toProblemDetail, type ProblemDetail } from './detail-data'
import { fetchProblemDetail } from './api'
import {
  getStudentContest,
  type StudentContestDetail,
  type StudentContestProblem,
} from '../contests/student-contests.api'

export type ContestProblemDetailState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'blocked'; message: string; contest?: StudentContestDetail }
  | { phase: 'error'; message: string; contest?: StudentContestDetail }
  | {
      phase: 'ready'
      contest: StudentContestDetail
      contestProblem: StudentContestProblem
      problem: ProblemDetail
    }

export function useContestProblemDetail(
  contestIdentifier: string | undefined,
  problemCode: string,
): { state: ContestProblemDetailState; retry: () => void } {
  const { user, isLoading, request } = useAuth()
  const [retryKey, setRetryKey] = useState(0)
  const [result, setResult] = useState<{
    key: string
    state: ContestProblemDetailState
  }>()
  const key = JSON.stringify([contestIdentifier ?? null, problemCode, user?.id, retryKey])
  const state = result?.key === key ? result.state : { phase: 'loading' as const }

  useEffect(() => {
    if (!contestIdentifier || isLoading) return
    let active = true
    const controller = new AbortController()
    const update = (next: ContestProblemDetailState) => {
      if (active) setResult({ key, state: next })
    }

    if (!user) {
      update({ phase: 'blocked', message: 'Vui lòng đăng nhập để truy cập bài tập trong cuộc thi.' })
      return () => {
        active = false
        controller.abort()
      }
    }

    update({ phase: 'loading' })
    void (async () => {
      let contest: StudentContestDetail
      try {
        contest = await getStudentContest(request, contestIdentifier, controller.signal)
      } catch (error) {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) {
          update({ phase: 'not-found' })
        } else {
          update({
            phase: 'error',
            message: error instanceof Error ? error.message : 'Không thể tải thông tin cuộc thi.',
          })
        }
        return
      }

      if (!contest.isRegistered) {
        update({
          phase: 'blocked',
          contest,
          message: 'Bạn cần đăng ký cuộc thi để truy cập đề bài.',
        })
        return
      }
      if (contest.timeStatus === 'UPCOMING') {
        update({
          phase: 'blocked',
          contest,
          message: 'Đề bài chỉ được mở khi cuộc thi bắt đầu.',
        })
        return
      }
      if (contest.timeStatus === 'ENDED') {
        update({
          phase: 'blocked',
          contest,
          message: 'Cuộc thi đã kết thúc; đề bài không còn được mở trong chế độ thi.',
        })
        return
      }

      const contestProblem = contest.problems.find(
        (problem) => problem.problemCode === problemCode,
      )
      if (!contestProblem) {
        update({
          phase: 'not-found',
        })
        return
      }

      try {
        const response = await fetchProblemDetail(request, problemCode, controller.signal)
        if (active) {
          update({
            phase: 'ready',
            contest,
            contestProblem,
            problem: toProblemDetail(response),
          })
        }
      } catch (error) {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) {
          update({ phase: 'not-found' })
        } else {
          update({
            phase: 'error',
            contest,
            message: error instanceof Error ? error.message : 'Không thể tải đề bài.',
          })
        }
      }
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [contestIdentifier, isLoading, key, problemCode, request, user])

  return { state, retry: () => setRetryKey((current) => current + 1) }
}
