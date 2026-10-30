import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatContestDate,
  ongoingContests,
  paginateContests,
  pastContests,
  searchContests,
  upcomingContests,
} from '../src/features/contests/data.ts'

test('provides multiple mock contests with status-consistent dates', () => {
  for (const [contests, status] of [
    [ongoingContests, 'ongoing'],
    [upcomingContests, 'upcoming'],
    [pastContests, 'past'],
  ] as const) {
    assert.ok(contests.length > 10)
    assert.ok(contests.every((contest) => contest.status === status))
    assert.ok(contests.every((contest) => Date.parse(contest.endTime) > Date.parse(contest.startTime)))
  }

  assert.ok(pastContests.every((contest) => Date.parse(contest.startTime) < Date.parse('2026-10-30T21:30:00+07:00')))
  assert.ok(upcomingContests.every((contest) => Date.parse(contest.startTime) > Date.parse('2026-10-30T21:30:00+07:00')))
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
