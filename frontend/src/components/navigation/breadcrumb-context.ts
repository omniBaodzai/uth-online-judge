import { createContext } from 'react'

export type BreadcrumbContextValue = {
  problemCode: string | null
  setProblemCode: (code: string | null) => void
  contestProblem: {
    contestIdentifier: string
    contestSlug: string
    contestTitle: string
    problemTitle: string
  } | null
  setContestProblem: (value: BreadcrumbContextValue['contestProblem']) => void
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  problemCode: null,
  setProblemCode: () => {},
  contestProblem: null,
  setContestProblem: () => {},
})
