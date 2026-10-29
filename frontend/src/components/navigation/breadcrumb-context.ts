import { createContext } from 'react'

export type BreadcrumbContextValue = {
  problemCode: string | null
  setProblemCode: (code: string | null) => void
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  problemCode: null,
  setProblemCode: () => {},
})
