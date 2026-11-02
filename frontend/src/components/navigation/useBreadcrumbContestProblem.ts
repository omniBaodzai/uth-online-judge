import { useContext, useEffect } from 'react'
import { BreadcrumbContext } from './breadcrumb-context'

export function useBreadcrumbContestProblem(
  contestIdentifier: string | undefined,
  contest: { slug: string; title: string } | null | undefined,
  problemTitle: string | null | undefined,
) {
  const { setContestProblem } = useContext(BreadcrumbContext)
  const contestSlug = contest?.slug
  const contestTitle = contest?.title

  useEffect(() => {
    if (!contestSlug || !contestTitle) {
      setContestProblem(null)
      return () => setContestProblem(null)
    }

    setContestProblem({
      contestIdentifier: contestIdentifier ?? contestSlug,
      contestSlug,
      contestTitle,
      problemTitle: problemTitle ?? 'Chi tiết bài tập',
    })
    return () => setContestProblem(null)
  }, [contestIdentifier, contestSlug, contestTitle, problemTitle, setContestProblem])
}
