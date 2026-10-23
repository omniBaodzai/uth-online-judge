import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { difficultyLabels, formatDate, statusLabels } from '../utils'
import type { AdminProblem, AdminProblemPage, AdminProblemStatus, AdminDifficulty } from '../types'
import styles from '../admin.module.css'

type PendingAction = { problem: AdminProblem; status: AdminProblemStatus | 'delete' }
const PAGE_SIZE = 20

function AdminProblemsPage() {
  const { request, setNotice } = useAdmin()
  const [page, setPage] = useState<AdminProblemPage | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminProblemStatus | 'all'>('all')
  const [difficulty, setDifficulty] = useState<AdminDifficulty | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchPage = useCallback(() => {
    const query = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) })
    if (search.trim()) query.set('search', search.trim())
    if (status !== 'all') query.set('status', status)
    if (difficulty !== 'all') query.set('difficulty', difficulty)
    return request<AdminProblemPage>(`/admin/problems?${query.toString()}`)
  }, [currentPage, difficulty, request, search, status])

  const load = useCallback(async () => {
    try {
      setPage(await fetchPage())
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách bài tập.')
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    let active = true
    fetchPage().then((data) => {
      if (active) setPage(data)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải danh sách bài tập.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fetchPage])

  function clearFilters() {
    if (search || status !== 'all' || difficulty !== 'all' || currentPage !== 1) {
      setLoading(true)
      setError('')
    }
    setSearch('')
    setStatus('all')
    setDifficulty('all')
    setCurrentPage(1)
  }

  async function completeAction() {
    if (!pending) return
    setSaving(true)
    setError('')
    const { problem, status: next } = pending
    try {
      if (next === 'delete') {
        await request<void>(`/admin/problems/${problem.id}`, { method: 'DELETE' })
        setNotice(`Đã xóa bài tập “${problem.code}”.`)
      } else {
        await request<AdminProblem>(`/admin/problems/${problem.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        })
        setNotice(`Đã chuyển “${problem.code}” sang trạng thái ${statusLabels[next]}.`)
      }
      setPending(null)
      setLoading(true)
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể lưu thay đổi.')
    } finally {
      setSaving(false)
    }
  }

  const problems = page?.items ?? []
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / PAGE_SIZE))

  return (
    <>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>NỘI DUNG HỌC TẬP</p><h1>Quản lý bài tập</h1><p className={styles.pageSubtitle}>Theo dõi và cập nhật bài tập đã lưu trong PostgreSQL.</p></div>
        <Link className={styles.buttonPrimary} to="/admin/problems/new"><AdminIcon name="plus" /> Tạo bài tập</Link>
      </div>
      <section className={styles.panel} aria-label="Danh sách bài tập" aria-busy={loading}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <AdminIcon name="search" size={18} />
            <input aria-label="Tìm theo mã hoặc tên bài tập" placeholder="Tìm theo mã hoặc tên bài tập…" value={search} onChange={(event) => { setLoading(true); setError(''); setSearch(event.target.value); setCurrentPage(1) }} />
          </label>
          <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => { setLoading(true); setError(''); setStatus(event.target.value as AdminProblemStatus | 'all'); setCurrentPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
          <select aria-label="Lọc theo độ khó" value={difficulty} onChange={(event) => { setLoading(true); setError(''); setDifficulty(event.target.value as AdminDifficulty | 'all'); setCurrentPage(1) }}>
            <option value="all">Tất cả độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <button className={styles.buttonQuiet} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
        {error && <p className={styles.formMessage} role="alert">{error} <button className={styles.textLink} type="button" onClick={() => { setLoading(true); setError(''); void load() }}>Thử lại</button></p>}
        <p className={styles.fieldHint} aria-live="polite">Hiển thị {problems.length} / {page?.total ?? 0} bài tập</p>
        {loading ? <p className={styles.emptyState} aria-live="polite">Đang tải dữ liệu…</p>
          : problems.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>{error ? 'Không thể tải danh sách' : 'Không tìm thấy bài tập phù hợp'}</h2>
              <p>Thử từ khóa khác hoặc xóa bộ lọc.</p>
              <button className={styles.buttonSecondary} type="button" onClick={clearFilters}>Xóa bộ lọc</button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.problemTable}>
                <thead><tr><th scope="col">Mã bài</th><th scope="col">Tên bài</th><th scope="col">Độ khó</th><th scope="col">Chủ đề</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th><th scope="col">Thao tác</th></tr></thead>
                <tbody>{problems.map((problem) => (
                  <tr key={problem.id}>
                    <td><span className={styles.code}>{problem.code}</span></td>
                    <td><Link className={styles.problemTitle} to={`/admin/problems/${problem.id}/edit`}>{problem.title}</Link><span className={styles.problemSummary}>{problem.summary}</span></td>
                    <td><span className={styles[`difficulty_${problem.difficulty}`]}>{difficultyLabels[problem.difficulty]}</span></td>
                    <td><div className={styles.tagList}>{problem.tags.length ? problem.tags.slice(0, 3).map((tag) => <span className={styles.tag} key={tag}>{tag}</span>) : <span className={styles.fieldHint}>Chưa gắn chủ đề</span>}</div></td>
                    <td><span className={`${styles.badge} ${styles[`status_${problem.status}`]}`}>{statusLabels[problem.status]}</span></td>
                    <td>{formatDate(problem.updatedAt)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link className={styles.iconButton} aria-label={`Chỉnh sửa ${problem.code}`} to={`/admin/problems/${problem.id}/edit`}><AdminIcon name="edit" size={15} /> Sửa</Link>
                        <Link className={styles.iconButton} aria-label={`Quản lý test case ${problem.code}`} to={`/admin/problems/${problem.id}/test-cases`}><AdminIcon name="tests" size={15} /> Test case</Link>
                        {problem.status === 'draft' && <button className={styles.iconButton} type="button" onClick={() => setPending({ problem, status: 'published' })}>Xuất bản</button>}
                        {problem.status === 'published' && <button className={styles.iconButton} type="button" onClick={() => setPending({ problem, status: 'archived' })}><AdminIcon name="archive" size={14} /> Lưu trữ</button>}
                        {problem.status === 'archived' && <button className={styles.iconButton} type="button" onClick={() => setPending({ problem, status: 'published' })}>Khôi phục</button>}
                        {problem.status === 'draft' && <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} type="button" aria-label={`Xóa ${problem.code}`} onClick={() => setPending({ problem, status: 'delete' })}><AdminIcon name="trash" size={14} /> Xóa</button>}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        <div className={styles.rowActions}>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage <= 1 || loading} onClick={() => { setLoading(true); setCurrentPage((value) => value - 1) }}>Trang trước</button>
          <span aria-live="polite">Trang {currentPage} / {totalPages}</span>
          <button className={styles.buttonSecondary} type="button" disabled={currentPage >= totalPages || loading} onClick={() => { setLoading(true); setCurrentPage((value) => value + 1) }}>Trang sau</button>
        </div>
      </section>
      {pending && (
        <ConfirmDialog
          title={pending.status === 'delete' ? 'Xóa bài tập?' : pending.status === 'published' ? 'Xuất bản bài tập?' : 'Lưu trữ bài tập?'}
          description={pending.status === 'delete'
            ? `“${pending.problem.code} — ${pending.problem.title}” sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.`
            : `Xác nhận đổi “${pending.problem.code} — ${pending.problem.title}” thành ${statusLabels[pending.status]}.`}
          confirmLabel={pending.status === 'delete' ? 'Xóa bài tập' : pending.status === 'published' ? 'Xuất bản' : 'Lưu trữ'}
          danger={pending.status === 'delete'}
          onConfirm={() => void completeAction()}
          onCancel={() => !saving && setPending(null)}
        />
      )}
      {saving && <p className={styles.fieldHint} aria-live="polite">Đang lưu thay đổi…</p>}
    </>
  )
}

export default AdminProblemsPage
