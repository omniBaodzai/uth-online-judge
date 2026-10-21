export type Contest = {
  id: string
  name: string
  kind: 'rated' | 'practice' | 'unrated'
  startsAt: string
  durationMinutes: number
  participants: number
  virtualParticipants: number
  isPrivate: boolean
}

export const contests: Contest[] = [
  { id: 'uth-round-12', name: 'UTH Programming Contest #12', kind: 'rated', startsAt: '2026-10-11T09:00:00+07:00', durationMinutes: 150, participants: 41, virtualParticipants: 1303, isPrivate: false },
  { id: 'freshman-cup-2026', name: 'UTH Freshman Cup 2026', kind: 'rated', startsAt: '2026-10-04T13:30:00+07:00', durationMinutes: 180, participants: 186, virtualParticipants: 724, isPrivate: false },
  { id: 'algorithm-week-3', name: 'Algorithm Practice Week 3', kind: 'practice', startsAt: '2026-09-27T19:00:00+07:00', durationMinutes: 120, participants: 20, virtualParticipants: 10, isPrivate: false },
  { id: 'uth-round-11', name: 'UTH Programming Contest #11', kind: 'rated', startsAt: '2026-09-20T09:00:00+07:00', durationMinutes: 150, participants: 52, virtualParticipants: 1184, isPrivate: false },
  { id: 'data-structures-open', name: 'Data Structures Open', kind: 'unrated', startsAt: '2026-09-06T14:00:00+07:00', durationMinutes: 120, participants: 96, virtualParticipants: 342, isPrivate: false },
  { id: 'uth-team-selection', name: 'UTH ICPC Team Selection', kind: 'rated', startsAt: '2026-08-30T08:00:00+07:00', durationMinutes: 300, participants: 28, virtualParticipants: 0, isPrivate: true },
  { id: 'summer-algorithm-series', name: 'Summer Algorithm Series - Final', kind: 'rated', startsAt: '2026-08-16T09:00:00+07:00', durationMinutes: 180, participants: 74, virtualParticipants: 601, isPrivate: false },
  { id: 'graph-challenge', name: 'Graph Theory Challenge', kind: 'practice', startsAt: '2026-08-02T19:30:00+07:00', durationMinutes: 120, participants: 33, virtualParticipants: 87, isPrivate: false },
  { id: 'uth-round-10', name: 'UTH Programming Contest #10', kind: 'rated', startsAt: '2026-07-19T09:00:00+07:00', durationMinutes: 150, participants: 63, virtualParticipants: 1058, isPrivate: false },
  { id: 'intra-uth-sprint', name: 'Intra-UTH Coding Sprint', kind: 'unrated', startsAt: '2026-07-05T13:00:00+07:00', durationMinutes: 90, participants: 20, virtualParticipants: 44, isPrivate: true },
  { id: 'dynamic-programming-cup', name: 'Dynamic Programming Cup', kind: 'rated', startsAt: '2026-06-21T09:00:00+07:00', durationMinutes: 180, participants: 88, virtualParticipants: 912, isPrivate: false },
  { id: 'uth-round-9', name: 'UTH Programming Contest #9', kind: 'rated', startsAt: '2026-06-07T09:00:00+07:00', durationMinutes: 150, participants: 57, virtualParticipants: 986, isPrivate: false },
]

export const contestPageSize = 6

export function formatContestDate(dateTime: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(dateTime))
}

export function formatContestDuration(durationMinutes: number) {
  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60
  return `${String(hours).padStart(2, '0')} giờ, ${String(minutes).padStart(2, '0')} phút`
}