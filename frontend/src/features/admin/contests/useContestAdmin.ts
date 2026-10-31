import { useContext } from 'react'
import { ContestAdminContext } from './contest-admin-context-value'

export function useContestAdmin() {
  const context = useContext(ContestAdminContext)
  if (!context) throw new Error('useContestAdmin must be used inside ContestAdminProvider')
  return context
}
