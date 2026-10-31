import { useMemo, useState, type ReactNode } from 'react'
import { allContests } from '../../contests/data'
import { sampleProblems } from '../../problems/data'
import { ContestAdminContext, type ContestAdminContextValue } from './contest-admin-context-value'
import type { Contest } from './types'

const defaultSettings = {
  visibility: 'public' as const,
  allowRegistration: true,
  showLeaderboard: true,
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function createSeedContests(): Contest[] {
  const existing = allContests.map((contest) => ({
    id: contest.id,
    code: slugify(contest.title),
    title: contest.title,
    description: 'Cuộc thi lập trình dành cho cộng đồng sinh viên UTH.',
    rules: 'Thí sinh tự chuẩn bị thiết bị và tuân thủ hướng dẫn của ban tổ chức.',
    startTime: contest.startTime,
    endTime: contest.endTime,
    durationMinutes: contest.durationMinutes,
    participantCount: contest.participantCount,
    publicationStatus: 'published' as const,
    settings: { ...defaultSettings },
    problems: contest.problems.map((problem) => ({
      problemId: problem.id,
      code: problem.code,
      title: problem.title,
      difficulty: problem.maxScore <= 100 ? 'easy' as const : problem.maxScore <= 200 ? 'medium' as const : 'hard' as const,
      maxScore: problem.maxScore,
    })),
    studentPageId: contest.id,
  }))

  const now = Date.now()
  const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString()
  const sampleContestProblems = sampleProblems.slice(0, 3).map((problem) => ({
    problemId: problem.id,
    code: problem.code,
    title: problem.title,
    difficulty: problem.points <= 100 ? 'easy' as const : problem.points <= 200 ? 'medium' as const : 'hard' as const,
    maxScore: problem.points,
  }))

  return [
    ...existing,
    {
      id: 'mock-draft-1',
      code: 'uth-warm-up-draft',
      title: 'UTH Warm-up — bản nháp',
      description: '',
      rules: '',
      startTime: inDays(4),
      endTime: inDays(4.1),
      durationMinutes: 90,
      participantCount: 0,
      publicationStatus: 'draft',
      settings: { ...defaultSettings },
      problems: sampleContestProblems,
    },
    {
      id: 'mock-draft-2',
      code: 'uth-olympic-trial-draft',
      title: 'Vòng thử nghiệm Olympic Tin học',
      description: '',
      rules: '',
      startTime: inDays(7),
      endTime: inDays(7.1),
      durationMinutes: 120,
      participantCount: 0,
      publicationStatus: 'draft',
      settings: { ...defaultSettings, visibility: 'private' },
      problems: [],
    },
    {
      id: 'mock-archived-1',
      code: 'uth-archive-sample',
      title: 'Cuộc thi mẫu đã lưu trữ',
      description: 'Dữ liệu mẫu để minh họa trạng thái lưu trữ.',
      rules: '',
      startTime: inDays(-5),
      endTime: inDays(-4.9),
      durationMinutes: 60,
      participantCount: 0,
      publicationStatus: 'archived',
      settings: { ...defaultSettings },
      problems: sampleContestProblems.slice(0, 1),
    },
  ]
}

export function ContestAdminProvider({ children }: { children: ReactNode }) {
  const [contests, setContests] = useState(createSeedContests)

  const value = useMemo<ContestAdminContextValue>(() => ({
    contests,
    getContest: (id) => contests.find((contest) => contest.id === id),
    saveContest: (values, status) => {
      const current = values.id
        ? contests.find((contest) => contest.id === values.id)
        : undefined
      const saved: Contest = {
        ...values,
        id: current?.id ?? `mock-${crypto.randomUUID()}`,
        participantCount: current?.participantCount ?? 0,
        publicationStatus: status,
      }

      setContests((items) => current
        ? items.map((contest) => contest.id === current.id ? saved : contest)
        : [saved, ...items])
      return saved
    },
    updatePublicationStatus: (id, status) => {
      setContests((items) => items.map((contest) => (
        contest.id === id ? { ...contest, publicationStatus: status } : contest
      )))
    },
  }), [contests])

  return <ContestAdminContext.Provider value={value}>{children}</ContestAdminContext.Provider>
}
