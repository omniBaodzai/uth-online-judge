import { useContext, useEffect } from 'react'
import { BreadcrumbContext } from './breadcrumb-context'

export function useBreadcrumbProblemCode(code: string | null | undefined) {
  const { setProblemCode } = useContext(BreadcrumbContext)

  useEffect(() => {
    setProblemCode(code || null)
    return () => setProblemCode(null)
  }, [code, setProblemCode])
}
