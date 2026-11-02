import { formatContestDate } from './data.ts'

export function formatParticipantRegistrationDate(value: string): string {
  return formatContestDate(value)
}
