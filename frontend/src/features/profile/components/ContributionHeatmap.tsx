import { useMemo } from 'react'
import styles from './ContributionHeatmap.module.css'

type Props = { data: { date: string; count: number }[] }

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

function key(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function level(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

function ContributionHeatmap({ data }: Props) {
  const { weeks, months } = useMemo(() => {
    const counts = new Map(data.map((item) => [item.date, item.count]))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Bắt đầu từ Chủ nhật của tuần chứa ngày cách đây 364 ngày để các cột thẳng hàng.
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay())

    const result: { date: string; count: number; future: boolean }[][] = []
    const labels: { index: number; label: string }[] = []
    let lastMonth = -1
    for (const cursor = new Date(start); cursor <= today; ) {
      const week: { date: string; count: number; future: boolean }[] = []
      for (let day = 0; day < 7; day += 1) {
        const id = key(cursor)
        week.push({ date: id, count: counts.get(id) ?? 0, future: cursor > today })
        if (day === 0 && cursor.getMonth() !== lastMonth) {
          lastMonth = cursor.getMonth()
          labels.push({ index: result.length, label: MONTHS[lastMonth] })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      result.push(week)
    }
    return { weeks: result, months: labels }
  }, [data])

  return (
    <div className={styles.scroll}>
      <div className={styles.months} style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }} aria-hidden="true">
        {months.map((month) => (
          <span key={month.index} style={{ gridColumn: month.index + 1 }}>
            {month.label}
          </span>
        ))}
      </div>
      <div className={styles.grid} role="img" aria-label="Biểu đồ hoạt động nộp bài trong 365 ngày gần nhất">
        {weeks.map((week) => (
          <div key={week[0].date} className={styles.week}>
            {week.map((cell) =>
              cell.future ? (
                <span key={cell.date} className={styles.empty} />
              ) : (
                <span
                  key={cell.date}
                  className={`${styles.cell} ${styles[`l${level(cell.count)}`]}`}
                  title={`${cell.count} lượt nộp · ${cell.date}`}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span>Ít</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`${styles.cell} ${styles[`l${l}`]}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  )
}

export default ContributionHeatmap
