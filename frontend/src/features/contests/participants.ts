import { formatContestDate, type Contest } from './data.ts'

export type ContestParticipantStatus = 'registered' | 'participated'

export type ContestParticipant = {
  id: string
  contestId: string
  username: string
  avatarUrl?: string
  registeredAt: string
  status: ContestParticipantStatus
}

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
]

const DAY_MS = 24 * 60 * 60 * 1000

function hashContestId(contestId: string): number {
  return [...contestId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 19)
}

function getUsername(index: number, seed: number): string {
  const username = usernames[(index * 11 + seed) % usernames.length]
  return index < usernames.length ? username : `${username}${Math.floor(index / usernames.length) + 1}`
}

export function createMockContestParticipants(
  contest: Pick<Contest, 'id' | 'participantCount' | 'startTime' | 'status'>,
): ContestParticipant[] {
  const seed = hashContestId(contest.id)
  const startTime = Date.parse(contest.startTime)
  const count = Math.max(0, Math.floor(contest.participantCount))

  return Array.from({ length: count }, (_, index) => {
    const registrationOffset = (1 + ((index * 13 + seed) % 45)) * DAY_MS
    const registeredAt = new Date(startTime - registrationOffset + ((index * 47 + seed) % 86_400) * 1000)
    const status: ContestParticipantStatus =
      contest.status !== 'upcoming' && (index * 17 + seed) % 100 < 62
        ? 'participated'
        : 'registered'

    return {
      id: `${contest.id}-participant-${index + 1}`,
      contestId: contest.id,
      username: getUsername(index, seed),
      registeredAt: registeredAt.toISOString(),
      status,
    }
  })
}

export function filterContestParticipants(
  participants: ContestParticipant[],
  query: string,
  status: ContestParticipantStatus | 'all',
): ContestParticipant[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  return participants.filter((participant) => {
    const matchesStatus = status === 'all' || participant.status === status
    const matchesUsername = !normalizedQuery || participant.username.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesStatus && matchesUsername
  })
}

export function formatParticipantRegistrationDate(value: string): string {
  return formatContestDate(value)
}
