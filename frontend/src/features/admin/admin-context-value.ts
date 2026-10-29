import { createContext } from 'react'

export type AdminContextValue = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  notice: string
  setNotice: (message: string) => void
}

export const AdminContext = createContext<AdminContextValue | null>(null)
