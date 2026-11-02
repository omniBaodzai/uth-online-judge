import { useMemo } from 'react'
import { useAdmin } from '../useAdmin'
import { createContestApi } from './contest-api'

export function useContestAdmin() {
  const { request } = useAdmin()
  return useMemo(() => createContestApi(request), [request])
}
