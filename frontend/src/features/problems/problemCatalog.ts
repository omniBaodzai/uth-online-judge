import { useEffect, useState } from 'react'
import { apiBaseUrl } from '../auth/api'
import { problems as staticProblems, type Problem, type ProblemDifficulty } from './data'
import { problemDetails, type ProblemDetail } from './data/problemDetails'

// Nguồn dữ liệu chính là DB (cùng bảng mà trang Admin chỉnh sửa).
// Dữ liệu tĩnh chỉ dùng bổ sung (trạng thái làm bài, đề bài chưa nhập) hoặc khi không gọi được API.

type CatalogRow = {
  code: string
  title: string
  score: number
  topic: string
  tags: string[]
  difficulty: ProblemDifficulty
  submissionCount: number
  acceptedCount: number
  acceptance: number
}

type DetailRow = Omit<CatalogRow, 'submissionCount' | 'acceptedCount' | 'acceptance'> & {
  description: string | null
  inputSpec: string | null
  outputSpec: string | null
  constraintsText: string | null
  source: string | null
  timeLimitSeconds: number
  memoryLimitMb: number
  examples: { input: string; output: string }[]
}

const staticById = new Map(staticProblems.map((problem) => [problem.id, problem]))

function toProblem(row: CatalogRow): Problem {
  const fallback = staticById.get(row.code.toUpperCase())
  const hasStats = row.submissionCount > 0
  return {
    id: row.code,
    title: row.title,
    tags: row.tags,
    topic: row.topic,
    score: row.score,
    difficulty: row.difficulty,
    acceptance: hasStats ? row.acceptance : (fallback?.acceptance ?? 0),
    acceptedCount: hasStats ? row.acceptedCount : (fallback?.acceptedCount ?? 0),
    status: fallback?.status ?? 'unsolved',
    hasEditorial: fallback?.hasEditorial ?? false,
  }
}

function toDetail(row: DetailRow): ProblemDetail {
  const fallback = problemDetails[row.code.toUpperCase()]
  const lines = (value: string | null) => (value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const description = lines(row.description)
  const constraints = lines(row.constraintsText)
  const examples = row.examples.map((example) => ({ input: example.input.replace(/\n$/, ''), output: example.output.replace(/\n$/, '') }))
  return {
    description: description.length ? description : (fallback?.description ?? ['Đề bài đang được cập nhật.']),
    input: row.inputSpec?.trim() || fallback?.input || 'Xem mô tả đề bài.',
    output: row.outputSpec?.trim() || fallback?.output || 'Xem mô tả đề bài.',
    constraints: constraints.length ? constraints : (fallback?.constraints ?? ['Không có giới hạn đặc biệt.']),
    examples: examples.length ? examples : (fallback?.examples ?? []),
    source: row.source?.trim() || fallback?.source || 'UTH Online Judge',
    timeLimit: `${row.timeLimitSeconds.toFixed(1)} giây`,
    memoryLimit: `${row.memoryLimitMb} MB`,
  }
}

export function useProblemCatalog() {
  const [state, setState] = useState<{ problems: Problem[]; isLoading: boolean }>({ problems: [], isLoading: true })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/api/problems`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<{ items: CatalogRow[] }>
      })
      .then((data) => setState({ problems: data.items.map(toProblem), isLoading: false }))
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name === 'AbortError') return
        setState({ problems: staticProblems, isLoading: false })
      })
    return () => controller.abort()
  }, [])

  return state
}

type ProblemState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; problem: Problem; detail: ProblemDetail }

export function useProblem(code: string): ProblemState {
  const [result, setResult] = useState<{ code: string; value: ProblemState } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const publish = (value: ProblemState) => setResult({ code, value })
    fetch(`${apiBaseUrl}/api/problems/${encodeURIComponent(code)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 404) return publish({ status: 'missing' })
        if (!response.ok) throw new Error(String(response.status))
        const row = (await response.json()) as DetailRow
        publish({
          status: 'ready',
          problem: toProblem({ ...row, submissionCount: 0, acceptedCount: 0, acceptance: 0 }),
          detail: toDetail(row),
        })
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name === 'AbortError') return
        const problem = staticById.get(code)
        const detail = problemDetails[code]
        publish(problem && detail ? { status: 'ready', problem, detail } : { status: 'missing' })
      })
    return () => controller.abort()
  }, [code])

  return result?.code === code ? result.value : { status: 'loading' }
}
