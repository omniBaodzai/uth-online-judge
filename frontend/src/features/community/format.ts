function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | null | undefined, locale = 'vi-VN'): string {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '—'
}

export function formatDateTime(value: string | null | undefined, locale = 'vi-VN'): string {
  const date = parseDate(value)
  return date
    ? new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
    : '—'
}

// Khối ngày bên trái trang chủ: ngày + tháng theo giờ địa phương.
export function toDateBlock(value: string | null | undefined, locale = 'vi-VN'): { day: string; month: string } {
  const date = parseDate(value)
  if (!date) return { day: '--', month: 'Th--' }
  const month = locale === 'vi-VN'
    ? `Th${date.getMonth() + 1}`
    : new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
  return { day: String(date.getDate()).padStart(2, '0'), month }
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
