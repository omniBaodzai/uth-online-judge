import { useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { AdminContext } from './admin-context-value'

export function AdminProvider({ children }: { children: ReactNode }) {
  const { request } = useAuth()
  const [notice, setNotice] = useState('')
  const value = useMemo(() => ({ request, notice, setNotice }), [request, notice])
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}
