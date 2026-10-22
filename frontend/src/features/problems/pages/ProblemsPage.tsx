import { useMemo, useState, type FormEvent } from 'react'
import SiteHeader from '../../../components/layout/SiteHeader'
import Pagination from '../../../components/ui/Pagination'
import ProblemFilter from '../components/ProblemFilter'
import ProblemTable from '../components/ProblemTable'
import {
  defaultProblemFilters,
  featuredProblemIds,
  problemPageSize,
  type Problem,
  type ProblemFilters,
} from '../data'
import { useProblemCatalog } from '../problemCatalog'
import styles from './ProblemsPage.module.css'

function ProblemsPage() {
  const { problems, isLoading } = useProblemCatalog()
  const problemTopics = useMemo(() => [...new Set(problems.map((problem) => problem.topic))].sort(), [problems])
  const [draftFilters, setDraftFilters] = useState<ProblemFilters>(defaultProblemFilters)
  const [filters, setFilters] = useState<ProblemFilters>(defaultProblemFilters)
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightedProblemId, setHighlightedProblemId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState('default')

  const filteredProblems = useMemo(() => problems.filter((problem) => {
    const keyword = filters.keyword.trim().toLocaleLowerCase('vi')
    const matchesKeyword = !keyword
      || problem.title.toLocaleLowerCase('vi').includes(keyword)
      || problem.id.toLocaleLowerCase('vi').includes(keyword)
      || problem.tags.some((tag) => tag.toLocaleLowerCase('vi').includes(keyword))
    const matchesTopic = filters.topic === 'Tất cả nhóm' || problem.topic === filters.topic
    const matchesDifficulty = filters.difficulty === 'Tất cả mức độ' || problem.difficulty === filters.difficulty
    const matchesScore = problem.score >= filters.minScore && problem.score <= filters.maxScore
    const matchesUnsolved = !filters.solvedOnly || problem.status !== 'solved'
    const matchesEditorial = !filters.editorialOnly || problem.hasEditorial

    return matchesKeyword && matchesTopic && matchesDifficulty && matchesScore && matchesUnsolved && matchesEditorial
  }), [filters, problems])

  const orderedProblems = useMemo(() => {
    const result = [...filteredProblems]
    if (sortOrder === 'score') result.sort((first, second) => first.score - second.score)
    if (sortOrder === 'acceptance') result.sort((first, second) => second.acceptance - first.acceptance)
    return result
  }, [filteredProblems, sortOrder])

  const totalPages = Math.ceil(orderedProblems.length / problemPageSize)
  const visibleProblems = orderedProblems.slice((currentPage - 1) * problemPageSize, currentPage * problemPageSize)
  const featuredProblems = featuredProblemIds
    .map((id) => problems.find((problem) => problem.id === id))
    .filter((problem): problem is Problem => problem !== undefined)

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(draftFilters)
    setCurrentPage(1)
    setHighlightedProblemId(null)
  }

  function showProblem(problem: Problem) {
    const matchingIndex = filteredProblems.findIndex((item) => item.id === problem.id)
    if (matchingIndex >= 0) {
      setCurrentPage(Math.floor(matchingIndex / problemPageSize) + 1)
      setHighlightedProblemId(problem.id)
      return
    }

    const nextFilters = { ...defaultProblemFilters, keyword: problem.id }
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
    setCurrentPage(1)
    setHighlightedProblemId(problem.id)
  }

  function chooseRandomProblem() {
    if (filteredProblems.length === 0) return
    const randomProblem = filteredProblems[Math.floor(Math.random() * filteredProblems.length)]
    showProblem(randomProblem)
  }

  const firstResult = orderedProblems.length === 0 ? 0 : (currentPage - 1) * problemPageSize + 1
  const lastResult = Math.min(currentPage * problemPageSize, orderedProblems.length)

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>LUYỆN TẬP LẬP TRÌNH</p>
            <h1>Danh sách bài tập</h1>
            <p className={styles.introText}>Chọn thử thách phù hợp và nâng cao kỹ năng thuật toán mỗi ngày.</p>
          </div>
          <div className={styles.problemCount}>
            <strong>{problems.length}</strong>
            <span>bài tập</span>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.listPanel} aria-label="Danh sách bài tập">
            <div className={styles.listHeader}>
              <div>
                <h2>Kho bài tập</h2>
                <p>Hiển thị {firstResult}–{lastResult} trong {orderedProblems.length} bài</p>
              </div>
              <label className={styles.sortControl}>
                <span>Sắp xếp</span>
                <select
                  aria-label="Sắp xếp bài tập"
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="default">Mặc định</option>
                  <option value="score">Điểm tăng dần</option>
                  <option value="acceptance">Tỷ lệ AC cao</option>
                </select>
              </label>
            </div>
            <ProblemTable problems={visibleProblems} highlightedProblemId={highlightedProblemId} isLoading={isLoading} />
            <div className={styles.paginationRow}>
              <span>{orderedProblems.length} kết quả</span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="bài tập"
              />
            </div>
          </section>

          <aside className={styles.sidebar} aria-label="Tìm kiếm và bài tập nổi bật">
            <ProblemFilter
              values={draftFilters}
              topics={problemTopics}
              onChange={setDraftFilters}
              onSubmit={applyFilters}
              onRandom={chooseRandomProblem}
            />
            <section className={styles.featuredPanel}>
              <div className={styles.featuredHeading}>
                <span aria-hidden="true">✦</span>
                <h2>Bài tập nổi bật</h2>
              </div>
              <p className={styles.featuredIntro}>Thử sức với những bài được cộng đồng quan tâm.</p>
              <div className={styles.featuredList}>
                {featuredProblems.map((problem, index) => (
                  <button
                    className={styles.featuredItem}
                    key={problem.id}
                    type="button"
                    onClick={() => showProblem(problem)}
                  >
                    <span className={styles.featuredNumber}>0{index + 1}</span>
                    <span className={styles.featuredCopy}>
                      <strong>{problem.title}</strong>
                      <small>{problem.topic} · {problem.score} điểm</small>
                    </span>
                    <span className={styles.featuredArrow} aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default ProblemsPage