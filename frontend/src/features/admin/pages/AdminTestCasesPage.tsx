import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import TestCaseCollectionEditor from '../components/TestCaseCollectionEditor'
import type {
  AdminProblem,
  AdminTestCaseCollection,
  AdminTestCaseDraft,
} from '../types'
import styles from '../admin.module.css'

function draftsFrom(collection: AdminTestCaseCollection): AdminTestCaseDraft[] {
  return collection.cases.map((testCase) => ({
    id: testCase.id,
    clientId: testCase.id,
    name: testCase.name,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    kind: testCase.kind,
  }))
}

function AdminTestCasesPage() {
  const { id = '' } = useParams()
  const { request, setNotice } = useAdmin()
  const [problem, setProblem] = useState<AdminProblem | null>(null)
  const [revision, setRevision] = useState(0)
  const [cases, setCases] = useState<AdminTestCaseDraft[]>([])
  const [savedCases, setSavedCases] = useState<AdminTestCaseDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(cases) !== JSON.stringify(savedCases)

  const load = useCallback(async () => {
    try {
      const [nextProblem, nextCollection] = await Promise.all([
        request<AdminProblem>(`/admin/problems/${id}`),
        request<AdminTestCaseCollection>(`/admin/problems/${id}/test-cases`),
      ])
      setProblem(nextProblem)
      const nextCases = draftsFrom(nextCollection)
      setRevision(nextCollection.revision)
      setCases(nextCases)
      setSavedCases(nextCases)
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải test case.')
    } finally {
      setLoading(false)
    }
  }, [id, request])

  useEffect(() => {
    let active = true
    Promise.all([
      request<AdminProblem>(`/admin/problems/${id}`),
      request<AdminTestCaseCollection>(`/admin/problems/${id}/test-cases`),
    ]).then(([nextProblem, nextCollection]) => {
      if (!active) return
      setProblem(nextProblem)
      const nextCases = draftsFrom(nextCollection)
      setRevision(nextCollection.revision)
      setCases(nextCases)
      setSavedCases(nextCases)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải test case.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id, request])

  async function save() {
    if (cases.some((testCase) => !testCase.name.trim() || testCase.expectedOutput.length === 0)) {
      setError('Vui lòng nhập tên và đầu ra mong đợi cho mọi test case.')
      return
    }
    if (problem?.status === 'published' && cases.length === 0) {
      setError('Bài đã xuất bản phải có ít nhất một test case.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const collection = await request<AdminTestCaseCollection>(`/admin/problems/${id}/test-cases`, {
        method: 'PUT',
        body: JSON.stringify({
          expectedRevision: revision,
          testCases: cases.map(({ id: caseId, name, input, expectedOutput, kind }) => ({
            ...(caseId ? { id: caseId } : {}),
            name: name.trim(),
            input,
            expectedOutput,
            kind,
            points: 1,
          })),
        }),
      })
      const nextCases = draftsFrom(collection)
      setRevision(collection.revision)
      setCases(nextCases)
      setSavedCases(nextCases)
      setNotice('Đã lưu toàn bộ danh sách test case.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể lưu test case.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className={styles.emptyState} aria-live="polite">Đang tải test case…</p>
  if (!problem) {
    return (
      <section className={styles.panel} role="alert">
        <h1>Không thể mở test case</h1>
        <p className={styles.pageSubtitle}>{error || 'Không tìm thấy bài tập.'}</p>
        <button className={styles.buttonSecondary} type="button" onClick={() => { setLoading(true); void load() }}>Tải lại</button>
        <Link className={styles.buttonSecondary} to="/admin/problems">Quay lại danh sách</Link>
      </section>
    )
  }

  const sampleCount = cases.filter((testCase) => testCase.kind === 'sample').length

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>BÀI TẬP / {problem.code}</p>
          <h1>Quản lý test case</h1>
          <p className={styles.pageSubtitle}>{problem.title} · {cases.length} test · tối đa {cases.length} điểm.</p>
        </div>
        <div className={styles.rowActions}>
          <Link className={styles.buttonSecondary} to={`/admin/problems/${problem.id}/edit`}><AdminIcon name="edit" /> Sửa bài tập</Link>
          <button className={styles.buttonPrimary} type="button" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Đang lưu…' : 'Lưu danh sách test'}
          </button>
        </div>
      </div>
      <div className={styles.demoNotice} role="note">
        <AdminIcon name="lock" size={16} />
        <span>Toàn bộ test case đều được chấm. Chỉ nội dung của test công khai mới xuất hiện trong đề bài; test ẩn chỉ quản trị viên được xem.</span>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Danh sách test case</h2>
            <p>{sampleCount} mẫu công khai · {cases.length - sampleCount} test ẩn · {cases.length} điểm tối đa</p>
          </div>
        </div>
        {error && <p className={styles.formMessage} role="alert">{error}</p>}
        <TestCaseCollectionEditor cases={cases} onChange={setCases} disabled={busy} />
        <div className={styles.rowActions}>
          <button className={styles.buttonPrimary} type="button" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Đang lưu…' : 'Lưu danh sách test'}
          </button>
        </div>
      </section>
    </>
  )
}

export default AdminTestCasesPage
