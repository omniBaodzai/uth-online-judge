import { useContext } from 'react'
import { AdminContext } from './admin-context-value'

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) throw new Error('useAdmin must be used inside AdminProvider')
  return context
}
