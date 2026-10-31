import type { Submission } from '../submissions/data.ts'
import type { GlobalSubmissionPage } from '../problems/submit/submission-service.ts'
import type { Contest } from './data.ts'
import { createMockContestSubmissions } from './statistics.ts'

const usernames = [
  'an.nguyen',
  'minhtran',
  'baolam_23',
  'thuy.pham',
  'coder_khanh',
  'hoangvu',
  'linhnguyen',
  'tuananh_dev',
  'phuongle',
  'quocbao',
  'dat.tran',
  'myhanh',
  'ducminh',
]

const verdictStatuses: Record<string, string> = {
  AC: 'ACCEPTED',
  WA: 'WRONG_ANSWER',
  CE: 'COMPILATION_ERROR',
  TLE: 'TIME_LIMIT_EXCEEDED',
}

function hashContestId(contestId: string): number {
  return [...contestId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 11)
}

function getSubmissionStatus(verdict: string, index: number): string {
  if (verdict !== 'ERR') return verdictStatuses[verdict] ?? verdict
  return ['RUNTIME_ERROR', 'MEMORY_LIMIT_EXCEEDED', 'INTERNAL_ERROR'][index % 3]
}

export function createMockContestSubmissionItems(contest: Contest): Submission[] {
  const problemsById = new Map(contest.problems.map((problem) => [problem.id, problem]))
  const submissions = createMockContestSubmissions(contest)
  const contestStart = Date.parse(contest.startTime)
  const contestDurationMs = contest.durationMinutes * 60_000
  const contestSeed = hashContestId(contest.id)

  const items: Submission[] = []
  submissions.forEach((submission, index) => {
    const problem = problemsById.get(submission.problemId)
    if (!problem) return

    const elapsedMs = submissions.length <= 1
      ? 0
      : Math.floor((index / (submissions.length - 1)) * contestDurationMs)
    const status = getSubmissionStatus(submission.verdict, index + contestSeed)

    items.push({
      id: submission.id,
      status,
      submittedAt: new Date(contestStart + elapsedMs).toISOString(),
      username: usernames[(index * 7 + contestSeed) % usernames.length],
      problemCode: problem.code,
      problemTitle: problem.title,
      language: submission.language,
      executionTimeMs: status === 'COMPILATION_ERROR' ? null : 15 + ((index * 37 + contestSeed) % 1800),
      memoryUsedKb: status === 'COMPILATION_ERROR' ? null : 1024 + ((index * 131 + contestSeed) % 128_000),
      canViewDetails: false,
    })
  })

  return items.sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt))
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
}

export function filterContestSubmissionItems(
  submissions: Submission[],
  filters: { query: string; verdict?: string; language?: string },
): Submission[] {
  const query = normalizeSearchText(filters.query.trim())
  return submissions.filter((submission) => {
    if (filters.verdict && submission.status !== filters.verdict) return false
    if (filters.language && submission.language !== filters.language) return false
    if (!query) return true

    return [
      submission.problemTitle,
      submission.problemCode,
      submission.username ?? '',
    ].some((value) => normalizeSearchText(value).includes(query))
  })
}

export function getContestSubmissionStatistics(
  submissions: Submission[],
): GlobalSubmissionPage['statistics'] {
  const verdictCounts: Record<string, number> = {}
  let accepted = 0

  for (const submission of submissions) {
    verdictCounts[submission.status] = (verdictCounts[submission.status] ?? 0) + 1
    if (submission.status === 'ACCEPTED') accepted += 1
  }

  return {
    total: submissions.length,
    accepted,
    acceptanceRate: submissions.length === 0 ? 0 : (accepted / submissions.length) * 100,
    verdictCounts,
  }
}
