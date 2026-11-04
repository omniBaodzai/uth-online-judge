export function formatParticipantRegistrationDate(value: string, locale = 'vi-VN'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}
