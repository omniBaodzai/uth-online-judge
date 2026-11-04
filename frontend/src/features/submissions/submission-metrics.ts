export function formatMemoryMiB(kb: number | null, fractionDigits = 1, locale = 'vi-VN'): string {
  return kb === null || !Number.isFinite(kb)
    ? '—'
    : `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(kb / 1024)} MiB`
}
