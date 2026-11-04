import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { fetchProblems, fetchTags, type ProblemListItem, type Tag } from '../api'
import FilterDropdown from '../components/FilterDropdown'
import { statusOptions, type ProblemStatus } from '../data'
import { useProblemsFetcher } from '../useProblemsFetcher'
import styles from './ProblemsPage.module.css'

const DEFAULT_PAGE_SIZE = submissionPageSizes[0]
const LATEST_COUNT = 5

function StatusIcon({ status, label }: { status: ProblemStatus; label: string }) {
  return (
    <span className={`${styles.statusIcon} ${styles[status]}`} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {status === 'solved' && <path d="m6 12.5 4 4 8-9" />}
        {status === 'wrong' && <path d="m7 7 10 10M17 7 7 17" />}
        {status === 'unsolved' && <circle cx="12" cy="12" r="1.2" />}
      </svg>
    </span>
  )
}

function formatDate(iso: string | null, locale: string) {
  return iso ? new Date(iso).toLocaleDateString(locale) : ''
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: ProblemListItem[]; total: number }

function ProblemsPage() {
  const { t, i18n } = useTranslation('pages')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const { fetcher, ready } = useProblemsFetcher()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [topicFilter, setTopicFilter] = useState<string[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [latest, setLatest] = useState<ProblemListItem[]>([])
  const [list, setList] = useState<ListState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // Chờ người dùng ngừng gõ rồi mới gọi API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    fetchTags(fetcher)
      .then((result) => !cancelled && setTags(result))
      .catch(() => undefined) // Thiếu danh sách chủ đề chỉ làm mất bộ lọc, không chặn danh sách bài.
    return () => {
      cancelled = true
    }
  }, [fetcher])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchProblems(fetcher, { pageSize: LATEST_COUNT, sort: 'createdAt', order: 'desc' })
      .then((result) => !cancelled && setLatest(result.items))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, reloadKey])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setList({ phase: 'loading' })
    fetchProblems(fetcher, {
      page,
      pageSize,
      sort: 'createdAt',
      order: 'desc',
      search,
      tags: topicFilter,
      status: statusFilter[0] as ProblemStatus | undefined,
    })
      .then((result) => {
        if (cancelled) return
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
        if (result.items.length === 0 && result.total > 0 && page > lastPage) {
          setPage(lastPage)
          return
        }
        setList({ phase: 'ready', items: result.items, total: result.total })
      })
      .catch((error: unknown) => {
      if (!cancelled) setList({ phase: 'error', message: errorMessage(error, t('loadProblemsError')) })
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, ready, page, pageSize, search, statusFilter, topicFilter, reloadKey, t])

  const topicFilterOptions = tags.map((tag) => ({ value: tag.slug, label: tag.name }))
  const statusFilterOptions = statusOptions.map((value) => ({
    value,
    label: t(value === 'solved' ? 'problemStatusSolved' : value === 'wrong' ? 'problemStatusWrong' : 'problemStatusUnsolved'),
  }))
  const isLoading = list.phase === 'loading'
  const totalItems = list.phase === 'ready' ? list.total : 0
  const paginationProps = {
    currentPage: page,
    pageSize,
    totalItems,
    pageSizes: submissionPageSizes,
    label: t('problemsPaginationLabel'),
    summaryLabel: t('problemsPaginationLabel'),
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.grid}>
        <h1 id="problems-title" className={styles.title}>{t('problemList')}</h1>

          <form className={styles.filters} role="search" onSubmit={(e) => e.preventDefault()}>
            <div className={styles.search}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                type="search"
                aria-label={t('searchProblemsLabel')}
                placeholder={t('searchProblems')}
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <FilterDropdown
              label={t('status')}
              options={statusFilterOptions}
              selected={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            />
            <FilterDropdown
              label={t('topic')}
              options={topicFilterOptions}
              selected={topicFilter}
              multiple
              onChange={(value) => {
                setTopicFilter(value)
                setPage(1)
              }}
            />
          </form>

          <div className={styles.card} aria-busy={isLoading}>
            <div className={styles.topPagination}>
              <SubmissionPagination {...paginationProps} showPageSize={false} />
            </div>
            {list.phase === 'loading' ? (
              <ul className={styles.skeletons} aria-label={t('loadingData')}>
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className={styles.skeleton} />
                ))}
              </ul>
            ) : list.phase === 'error' ? (
              <div className={styles.empty} role="alert">
                <strong>{t('loadProblemsError')}</strong>
                <p>{list.message}</p>
                <button className={styles.retry} type="button" onClick={() => setReloadKey((key) => key + 1)}>
                  {t('retry')}
                </button>
              </div>
            ) : list.items.length === 0 ? (
              <div className={styles.empty}>
                <strong>{t('noMatchingProblems')}</strong>
                <p>{t('adjustSearch')}</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.center}>{t('status')}</th>
                      <th scope="col">{t('problemCode')}</th>
                      <th scope="col">{t('problemName')}</th>
                      <th scope="col" className={styles.num}>{t('points')}</th>
                      <th scope="col" className={styles.num}>{t('acceptanceRate')}</th>
                      <th scope="col" className={styles.num}>{t('acceptedCount')}</th>
                      <th scope="col" className={styles.center}>{t('solution')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((p) => (
                      <tr key={p.code}>
                        <td className={styles.center}>
                          <StatusIcon
                            status={p.status}
                            label={t(p.status === 'solved' ? 'problemStatusSolved' : p.status === 'wrong' ? 'problemStatusWrong' : 'problemStatusUnsolved')}
                          />
                        </td>
                        <td className={styles.code}>{p.code}</td>
                        <td>
                          <Link className={styles.titleLink} to={`/problems/${p.code}`}>
                            {p.title}
                          </Link>
                        </td>
                        <td className={styles.num}>{p.scoringEnabled ? p.points : '—'}</td>
                        <td className={styles.num}>{p.acceptanceRate.toFixed(1)}%</td>
                        <td className={styles.num}>{p.acCount.toLocaleString(locale)}</td>
                        <td className={styles.center}>
                          {p.hasSolution ? (
                            <Link
                              className={styles.solutionLink}
                              to={`/problems/${p.code}/solution`}
                              aria-label={`${t('solution')} ${p.title}`}
                              title={t('solution')}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
                              </svg>
                            </Link>
                          ) : (
                            <span className={styles.noSolution} aria-label={t('noSolution')}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.footer}>
              <SubmissionPagination {...paginationProps} />
            </div>
          </div>

        <aside className={styles.latest} aria-labelledby="latest-title">
          <h2 id="latest-title">{t('latestProblems')}</h2>
          {latest.length === 0 ? (
            <p>{t('noPublishedProblems')}</p>
          ) : (
            <ol className={styles.latestList}>
              {latest.map((p) => (
                <li key={p.code}>
                  <Link to={`/problems/${p.code}`}>
                    <span className={styles.latestTitle}>{p.title}</span>
                    <span className={styles.latestMeta}>
                      {p.code} · {formatDate(p.publishedAt, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  )
}

export default ProblemsPage
