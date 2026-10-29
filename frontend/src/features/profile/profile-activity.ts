export type ActivityRecord = { date: string; count: number }
export type ActivityDay = ActivityRecord & { level: 0 | 1 | 2 | 3 | 4 }

function activityLevel(count: number): ActivityDay['level'] {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

export function buildActivityDays(activity: ActivityRecord[], today = new Date()): ActivityDay[] {
  const counts = new Map(activity.map((item) => [item.date, item.count]))
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 364 - start.getUTCDay())
  const days: ActivityDay[] = []

  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10)
    const count = counts.get(key) ?? 0
    days.push({ date: key, count, level: activityLevel(count) })
  }
  return days
}