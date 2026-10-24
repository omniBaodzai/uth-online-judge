export function formatMemoryMiB(kb: number | null, fractionDigits = 1): string {
  return kb === null || !Number.isFinite(kb)
    ? '—'
    : `${(kb / 1024).toFixed(fractionDigits)} MiB`
}
