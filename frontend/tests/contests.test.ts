import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatContestDate,
  getContestById,
  getCountdownParts,
  ongoingContests,
  paginateContests,
  pastContests,
  searchContests,
  upcomingContests,
} from '../src/features/contests/data.ts'
import {
  aggregateContestStatistics,
  createMockContestSubmissions,
  getMockContestStatistics,
} from '../src/features/contests/statistics.ts'
import {
  createMockContestLeaderboard,
  formatContestDuration,
  rankContestLeaderboard,
  searchContestLeaderboard,
  type ContestLeaderboardEntry,
} from '../src/features/contests/leaderboard.ts'
import {
  createMockContestSubmissionItems,
  filterContestSubmissionItems,
  getContestSubmissionStatistics,
} from '../src/features/contests/contest-submissions.ts'
import {
  createMockContestParticipants,
  filterContestParticipants,
  formatParticipantRegistrationDate,
} from '../src/features/contests/participants.ts'

test('provides multiple mock contests with status-consistent dates', () => {
  const now = Date.now()
  for (const [contests, status] of [
    [ongoingContests, 'ongoing'],
    [upcomingContests, 'upcoming'],
    [pastContests, 'past'],
  ] as const) {
    assert.ok(contests.length > 10)
    assert.ok(contests.every((contest) => contest.status === status))
    assert.ok(contests.every((contest) => Date.parse(contest.endTime) > Date.parse(contest.startTime)))
  }

  assert.ok(ongoingContests.every((contest) => Date.parse(contest.startTime) <= now && Date.parse(contest.endTime) > now))
  assert.ok(pastContests.every((contest) => Date.parse(contest.endTime) < now))
  assert.ok(upcomingContests.every((contest) => Date.parse(contest.startTime) > now))
  assert.ok(ongoingContests[0].problems.length > 10)
  assert.equal(getContestById(ongoingContests[0].id), ongoingContests[0])
})

test('searches Vietnamese contest titles without requiring diacritics', () => {
  assert.equal(searchContests(ongoingContests, 'lap trinh huong').length, 1)
  assert.equal(searchContests(ongoingContests, '  UTH WEEKLY  ')[0]?.id, ongoingContests[0].id)
  assert.equal(searchContests(ongoingContests, '   ').length, ongoingContests.length)
})

test('paginates filtered mock contests without changing the source collection', () => {
  const filtered = searchContests(upcomingContests, 'summer')
  assert.equal(paginateContests(filtered, 1, 1).length, 1)
  assert.equal(paginateContests(filtered, 1, 1)[0].title, 'Summer Code Challenge')
  assert.equal(upcomingContests.length, 24)
})

test('formats contest date and time in Vietnamese day/month order', () => {
  assert.equal(formatContestDate('2026-11-01T09:00:00+07:00'), '01/11/2026 09:00:00')
})

test('calculates non-negative countdown parts from timestamps', () => {
  assert.deepEqual(getCountdownParts('2026-11-01T00:00:00.000Z', Date.parse('2026-10-30T21:00:00.000Z')), {
    days: 1,
    hours: 3,
    minutes: 0,
    seconds: 0,
  })
  assert.deepEqual(getCountdownParts('2026-10-30T20:00:00.000Z', Date.parse('2026-10-30T21:00:00.000Z')), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  assert.deepEqual(getCountdownParts('invalid', Date.now()), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
})

test('builds contest chart data from one consistent mock submission collection', () => {
  const contest = ongoingContests[0]
  const statistics = getMockContestStatistics(contest)
  const problemTotal = statistics.problems.reduce((sum, problem) => sum + problem.total, 0)
  const languageTotal = statistics.languages.reduce((sum, language) => sum + language.total, 0)
  const verdictTotal = Object.values(statistics.verdictTotals).reduce((sum, count) => sum + count, 0)

  assert.equal(statistics.totalSubmissions, statistics.submissions.length)
  assert.equal(problemTotal, statistics.totalSubmissions)
  assert.equal(languageTotal, statistics.totalSubmissions)
  assert.equal(verdictTotal, statistics.totalSubmissions)
  assert.ok(statistics.problems.every(({ acceptanceRate }) => acceptanceRate >= 0 && acceptanceRate <= 100))
  assert.ok(statistics.languages.every(({ acceptanceRate }) => acceptanceRate >= 0 && acceptanceRate <= 100))
  assert.equal(createMockContestSubmissions(contest).length, statistics.submissions.length)
})

test('returns zero acceptance rates and totals for a contest with no submissions', () => {
  const statistics = aggregateContestStatistics(ongoingContests[0].problems, [])

  assert.equal(statistics.totalSubmissions, 0)
  assert.ok(statistics.problems.every(({ total, accepted, acceptanceRate }) => total === 0 && accepted === 0 && acceptanceRate === 0))
  assert.ok(statistics.languages.every(({ total, accepted, acceptanceRate }) => total === 0 && accepted === 0 && acceptanceRate === 0))
})

test('ranks contest coders by score, then accepted time, placing no-AC coders last on ties', () => {
  const entries: ContestLeaderboardEntry[] = [
    { id: 'later', username: 'later', totalScore: 200, acceptedCount: 2, attemptedCount: 3, lastAcceptedTimeMs: 90_000 },
    { id: 'no-ac', username: 'no-ac', totalScore: 200, acceptedCount: 0, attemptedCount: 2, lastAcceptedTimeMs: null },
    { id: 'earlier', username: 'earlier', totalScore: 200, acceptedCount: 1, attemptedCount: 1, lastAcceptedTimeMs: 60_000 },
    { id: 'higher', username: 'higher', totalScore: 300, acceptedCount: 1, attemptedCount: 1, lastAcceptedTimeMs: 120_000 },
  ]

  assert.deepEqual(rankContestLeaderboard(entries).map(({ id, rank }) => [id, rank]), [
    ['higher', 1],
    ['earlier', 2],
    ['later', 3],
    ['no-ac', 4],
  ])
})

test('keeps global ranks when searching and paginating contest leaderboard entries', () => {
  const rankedEntries = rankContestLeaderboard(createMockContestLeaderboard(ongoingContests[0].id, 5))
  const searchedEntries = searchContestLeaderboard(rankedEntries, rankedEntries[11].username)

  assert.equal(searchedEntries.length, 1)
  assert.equal(searchedEntries[0].rank, rankedEntries[11].rank)
  assert.ok(rankedEntries.length > 10)
  assert.equal(paginateContests(rankedEntries, 2, 10)[0].rank, 11)
  assert.deepEqual(rankContestLeaderboard([]), [])
})

test('formats elapsed contest time and displays missing accepted time as a dash', () => {
  assert.equal(formatContestDuration(25 * 60 * 60_000 + 9 * 60_000), '25:09')
  assert.equal(formatContestDuration(null), '—')
  assert.equal(formatContestDuration(-1), '—')
})

test('creates contest submission rows from the same mock records used by contest statistics', () => {
  const contest = ongoingContests[0]
  const rows = createMockContestSubmissionItems(contest)
  const chartStats = getMockContestStatistics(contest)
  const listStats = getContestSubmissionStatistics(rows)
  const rowVerdictCounts = Object.values(listStats.verdictCounts).reduce((sum, count) => sum + count, 0)

  assert.equal(rows.length, chartStats.totalSubmissions)
  assert.equal(rowVerdictCounts, rows.length)
  assert.equal(listStats.accepted, chartStats.verdictTotals.AC)
  assert.ok(rows.every((row) => row.id.startsWith(`${contest.id}-`)))
  assert.ok(rows.every((row) => Date.parse(row.submittedAt) >= Date.parse(contest.startTime)))
  assert.ok(rows.every((row) => Date.parse(row.submittedAt) <= Date.parse(contest.endTime)))
})

test('filters all contest submission rows and derives matching chart statistics', () => {
  const rows = createMockContestSubmissionItems(ongoingContests[0])
  const filtered = filterContestSubmissionItems(rows, { query: 'tổng hai' })
  const languageFiltered = filterContestSubmissionItems(filtered, { query: 'tổng hai', language: 'C++17' })
  const acceptedFiltered = filterContestSubmissionItems(filtered, { query: 'tổng hai', verdict: 'ACCEPTED' })
  const statistics = getContestSubmissionStatistics(filtered)
  const languageStatistics = getContestSubmissionStatistics(languageFiltered)

  assert.ok(filtered.length > 10)
  assert.ok(filtered.every((row) => row.problemTitle === 'Tổng hai số nguyên'))
  assert.ok(languageFiltered.every((row) => row.language === 'C++17'))
  assert.ok(languageFiltered.length < filtered.length)
  assert.ok(acceptedFiltered.every((row) => row.status === 'ACCEPTED'))
  assert.equal(statistics.total, filtered.length)
  assert.ok(statistics.total > filtered.slice(0, 10).length)
  assert.equal(statistics.accepted, filtered.filter((row) => row.status === 'ACCEPTED').length)
  assert.equal(languageStatistics.total, languageFiltered.length)
  assert.equal(
    Object.values(statistics.verdictCounts).reduce((sum, count) => sum + count, 0),
    filtered.length,
  )
})

test('returns an empty contest submissions dataset and zero statistics for a contest without problems', () => {
  const emptyContest = { ...ongoingContests[0], problems: [] }
  const rows = createMockContestSubmissionItems(emptyContest)
  const statistics = getContestSubmissionStatistics(rows)

  assert.deepEqual(rows, [])
  assert.equal(statistics.total, 0)
  assert.equal(statistics.accepted, 0)
  assert.deepEqual(statistics.verdictCounts, {})
})

test('creates contest-specific participant records matching each contest participant count', () => {
  for (const contest of [ongoingContests[0], upcomingContests[1], pastContests[2]]) {
    const participants = createMockContestParticipants(contest)

    assert.equal(participants.length, contest.participantCount)
    assert.ok(participants.every((participant) => participant.contestId === contest.id))
    assert.equal(new Set(participants.map((participant) => participant.id)).size, participants.length)
    assert.ok(participants.every((participant) => participant.registeredAt.length > 0))
    assert.ok(participants.every((participant) => participant.status === 'registered' || participant.status === 'participated'))
    assert.ok(participants.every((participant) => participant.status === 'registered' || contest.status !== 'upcoming'))
    assert.ok(participants.every((participant) => participant.avatarUrl === undefined))
  }
})

test('filters contest participants by case-insensitive username and status together', () => {
  const participants = createMockContestParticipants(ongoingContests[0])
  const target = participants.find((participant) => participant.status === 'participated')
  assert.ok(target)

  const matching = filterContestParticipants(participants, target.username.toUpperCase(), 'participated')
  const statusOnly = filterContestParticipants(participants, '', 'registered')
  const absent = filterContestParticipants(participants, 'no-such-coder', 'all')

  assert.ok(matching.includes(target))
  assert.ok(matching.every((participant) => participant.status === 'participated'))
  assert.ok(matching.every((participant) => participant.username.toLocaleLowerCase('vi').includes(target.username.toLocaleLowerCase('vi'))))
  assert.ok(statusOnly.length > 0)
  assert.ok(statusOnly.every((participant) => participant.status === 'registered'))
  assert.deepEqual(absent, [])
})

test('formats participant registration timestamps in the requested date and time order', () => {
  const participant = createMockContestParticipants(ongoingContests[0])[0]
  assert.match(formatParticipantRegistrationDate(participant.registeredAt), /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
})
