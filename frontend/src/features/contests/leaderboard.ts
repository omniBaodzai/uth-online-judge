export function formatContestDuration(durationMs: number | null, locale = 'en-US'): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return '—'
  const totalMinutes = Math.floor(durationMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const formatter = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  return `${formatter.format(hours)}:${formatter.format(minutes)}`
}
