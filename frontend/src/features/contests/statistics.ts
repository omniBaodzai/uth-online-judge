import type { Contest, ContestProblem } from './data'

export const contestLanguages = ['C++17', 'C++20', 'C++14', 'Python 3', 'Java 17'] as const
export const contestVerdicts = ['AC', 'WA', 'CE', 'TLE', 'ERR'] as const

export type ContestVerdict = (typeof contestVerdicts)[number]

export type ContestSubmission = {
  id: string
  problemId: string
  language: (typeof contestLanguages)[number]
  verdict: ContestVerdict
}

export type ProblemContestStats = {
  problem: ContestProblem
  counts: Record<ContestVerdict, number>
  total: number
  accepted: number
  acceptanceRate: number
}

export type LanguageContestStats = {
  language: (typeof contestLanguages)[number]
  counts: Record<ContestVerdict, number>
  total: number
  accepted: number
  acceptanceRate: number
}

export type ContestStatistics = {
  submissions: ContestSubmission[]
  problems: ProblemContestStats[]
  languages: LanguageContestStats[]
  verdictTotals: Record<ContestVerdict, number>
  totalSubmissions: number
}

const verdictPattern: ContestVerdict[] = ['AC', 'WA', 'AC', 'TLE', 'WA', 'CE', 'AC', 'ERR']

function createEmptyCounts(): Record<ContestVerdict, number> {
  return { AC: 0, WA: 0, CE: 0, TLE: 0, ERR: 0 }
}

function hashContestId(contestId: string): number {
  return [...contestId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 7)
}

export function createMockContestSubmissions(contest: Contest): ContestSubmission[] {
  const contestSeed = hashContestId(contest.id)
  const submissions: ContestSubmission[] = []

  contest.problems.forEach((problem, problemIndex) => {
    contestLanguages.forEach((language, languageIndex) => {
      const count = 2 + ((problemIndex * 7 + languageIndex * 11 + contestSeed) % 8)
      for (let submissionIndex = 0; submissionIndex < count; submissionIndex += 1) {
        const verdictIndex = (submissionIndex + problemIndex * 2 + languageIndex + contestSeed) % verdictPattern.length
        submissions.push({
          id: `${contest.id}-${problem.id}-${languageIndex}-${submissionIndex}`,
          problemId: problem.id,
          language,
          verdict: verdictPattern[verdictIndex],
        })
      }
    })
  })

  return submissions
}

function rate(accepted: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (accepted / total) * 100))
}

export function aggregateContestStatistics(
  problems: ContestProblem[],
  submissions: ContestSubmission[],
): ContestStatistics {
  const problemCounts = new Map(problems.map((problem) => [problem.id, createEmptyCounts()]))
  const languageCounts = new Map(contestLanguages.map((language) => [language, createEmptyCounts()]))
  const verdictTotals = createEmptyCounts()

  for (const submission of submissions) {
    const problem = problemCounts.get(submission.problemId)
    const language = languageCounts.get(submission.language)
    if (!problem || !language || !contestVerdicts.includes(submission.verdict)) continue
    problem[submission.verdict] += 1
    language[submission.verdict] += 1
    verdictTotals[submission.verdict] += 1
  }

  const problemStats = problems.map((problem) => {
    const counts = problemCounts.get(problem.id) ?? createEmptyCounts()
    const total = contestVerdicts.reduce((sum, verdict) => sum + counts[verdict], 0)
    return {
      problem,
      counts,
      total,
      accepted: counts.AC,
      acceptanceRate: rate(counts.AC, total),
    }
  })

  const languageStats = contestLanguages.map((language) => {
    const counts = languageCounts.get(language) ?? createEmptyCounts()
    const total = contestVerdicts.reduce((sum, verdict) => sum + counts[verdict], 0)
    return {
      language,
      counts,
      total,
      accepted: counts.AC,
      acceptanceRate: rate(counts.AC, total),
    }
  })

  return {
    submissions,
    problems: problemStats,
    languages: languageStats,
    verdictTotals,
    totalSubmissions: contestVerdicts.reduce((sum, verdict) => sum + verdictTotals[verdict], 0),
  }
}

export function getMockContestStatistics(contest: Contest): ContestStatistics {
  const submissions = createMockContestSubmissions(contest)
  return aggregateContestStatistics(contest.problems, submissions)
}

export function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  return `${Number(safeValue.toFixed(2)).toLocaleString('vi-VN')}%`
}

export function formatSubmissionCount(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('vi-VN')
}
