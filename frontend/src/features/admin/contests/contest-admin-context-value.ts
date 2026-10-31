import { createContext } from 'react'
import type {
  Contest,
  ContestFormValues,
  ContestPublicationStatus,
} from './types'

export type ContestAdminContextValue = {
  contests: Contest[]
  getContest: (id: string) => Contest | undefined
  saveContest: (values: ContestFormValues, status: ContestPublicationStatus) => Contest
  updatePublicationStatus: (id: string, status: ContestPublicationStatus) => void
}

export const ContestAdminContext = createContext<ContestAdminContextValue | null>(null)
