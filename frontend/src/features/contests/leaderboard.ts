export type ContestLeaderboardEntry = {
  id: string
  username: string
  totalScore: number
  acceptedCount: number
  attemptedCount: number
  lastAcceptedTimeMs: number | null
}

export type RankedContestEntry = ContestLeaderboardEntry & {
  rank: number
}

const mockUsernames = [
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
  'ngocanh_uth',
  'huynguyen',
  'nhatnam',
  'kiet_le',
  'thanhha',
  'trungkien',
  'vananh',
  'long.pham',
  'minhthu',
  'thienbao',
  'hoanglong',
  'nhuquynh',
  'vietanh',
  'phucnguyen',
  'kimngan',
  'thanhdat',
  'nguyenlinh',
  'son_tung',
  'baochau',
  'tienminh',
  'haianh',
  'duy_khoa',
  'thanhtruc',
]

function hashContestId(contestId: string): number {
  return [...contestId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 13)
}

export function createMockContestLeaderboard(
  contestId: string,
  problemCount: number,
): ContestLeaderboardEntry[] {
  const seed = hashContestId(contestId)
  return mockUsernames.map((username, index) => {
    const acceptedCount = index >= 32 ? 0 : Math.max(0, 5 - Math.floor(index / 7) - ((index + seed) % 3 === 0 ? 1 : 0))
    const attemptedCount = acceptedCount === 0
      ? (index >= 32 ? 0 : 1 + ((index + seed) % Math.max(1, problemCount)))
      : Math.min(problemCount, acceptedCount + ((index + seed) % 3))
    const normalizedAcceptedCount = Math.min(problemCount, acceptedCount)
    const scoreGroup = Math.floor(index / 3)
    const totalScore = normalizedAcceptedCount === 0
      ? 0
      : Math.max(100, 500 - scoreGroup * 35 - ((index + seed) % 2) * 10)

    return {
      id: `${contestId}-coder-${index + 1}`,
      username,
      totalScore,
      acceptedCount: normalizedAcceptedCount,
      attemptedCount,
      lastAcceptedTimeMs: normalizedAcceptedCount > 0
        ? (35 + ((index * 17 + seed) % 145)) * 60 * 1000
        : null,
    }
  })
}

export function rankContestLeaderboard(entries: ContestLeaderboardEntry[]): RankedContestEntry[] {
  return [...entries]
    .sort((left, right) => {
      if (left.totalScore !== right.totalScore) return right.totalScore - left.totalScore
      if (left.lastAcceptedTimeMs === null && right.lastAcceptedTimeMs !== null) return 1
      if (left.lastAcceptedTimeMs !== null && right.lastAcceptedTimeMs === null) return -1
      if (left.lastAcceptedTimeMs !== null && right.lastAcceptedTimeMs !== null) {
        if (left.lastAcceptedTimeMs !== right.lastAcceptedTimeMs) {
          return left.lastAcceptedTimeMs - right.lastAcceptedTimeMs
        }
      }
      return left.id.localeCompare(right.id)
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export function searchContestLeaderboard(
  entries: RankedContestEntry[],
  query: string,
): RankedContestEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  if (!normalizedQuery) return entries
  return entries.filter((entry) => entry.username.toLocaleLowerCase('vi').includes(normalizedQuery))
}

export function formatContestDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return '—'
  const totalMinutes = Math.floor(durationMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
