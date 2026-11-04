import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { toProblemDetail, type ProblemDetail } from './detail-data'
import { fetchProblemDetail } from './api'
import {
  getStudentContest,
  type StudentContestDetail,
  type StudentContestProblem,
} from '../contests/student-contests.api'
import './i18n'

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
  const { t } = useTranslation('pages')
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
      update({ phase: 'blocked', message: t('problemSignInForContest') })
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
            message: error instanceof Error ? error.message : t('problemCannotLoadContestInfo'),
          })
        }
        return
      }

      if (!contest.isRegistered) {
        update({
          phase: 'blocked',
          contest,
          message: t('problemRegisterForContest'),
        })
        return
      }
      if (contest.timeStatus === 'UPCOMING') {
        update({
          phase: 'blocked',
          contest,
          message: t('problemOpensWhenContestStarts'),
        })
        return
      }
      if (contest.timeStatus === 'ENDED') {
        update({
          phase: 'blocked',
          contest,
          message: t('problemContestEndedNoAccess'),
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
            message: error instanceof Error ? error.message : t('problemCannotLoadStatement'),
          })
        }
      }
    })()

    return () => {
      active = false
      controller.abort()
    }
  }, [contestIdentifier, isLoading, key, problemCode, request, user, t])

  return { state, retry: () => setRetryKey((current) => current + 1) }
}
