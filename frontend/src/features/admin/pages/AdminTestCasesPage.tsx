import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { AdminProblem, AdminTestCase, TestCaseKind } from '../types'
import styles from '../admin.module.css'

type CaseForm = Omit<AdminTestCase, 'id' | 'position'>

const blankCase: CaseForm = { name: '', input: '', expectedOutput: '', kind: 'hidden', points: null }

function formFrom(testCase: AdminTestCase): CaseForm {
  return {
    name: testCase.name,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    kind: testCase.kind,
    points: testCase.points,
  }
}

function AdminTestCasesPage() {
  const { id = '' } = useParams()
  const { request, setNotice } = useAdmin()
  const [problem, setProblem] = useState<AdminProblem | null>(null)
  const [cases, setCases] = useState<AdminTestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<CaseForm>(blankCase)
  const [deleteTarget, setDeleteTarget] = useState<AdminTestCase | null>(null)

  const fetchData = useCallback(() => Promise.all([
        request<AdminProblem>(`/admin/problems/${id}`),
        request<AdminTestCase[]>(`/admin/problems/${id}/test-cases`),
      ]), [id, request])

  const load = useCallback(async () => {
    try {
      const [nextProblem, nextCases] = await fetchData()
      setProblem(nextProblem)
      setCases(nextCases)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải test case.')
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData().then(([nextProblem, nextCases]) => {
      if (!active) return
      setProblem(nextProblem)
      setCases(nextCases)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải test case.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fetchData])

  function startNew() {
    setEditingId(null)
    setDraft({ ...blankCase })
    setError('')
    setFormOpen(true)
  }

  function startEdit(testCase: AdminTestCase) {
    setEditingId(testCase.id)
    setDraft(formFrom(testCase))
    setError('')
    setFormOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim() || draft.expectedOutput.length === 0) {
      setError('Vui lòng nhập tên và output mong đợi. Input có thể để trống; dấu cách và xuống dòng trong dữ liệu được giữ nguyên.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await request<AdminTestCase>(
        editingId ? `/admin/problems/${id}/test-cases/${editingId}` : `/admin/problems/${id}/test-cases`,
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...draft, name: draft.name.trim() }),
        },
      )
      setNotice(`Đã ${editingId ? 'cập nhật' : 'thêm'} test case trên máy chủ.`)
      setFormOpen(false)
      setEditingId(null)
      setDraft({ ...blankCase })
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể lưu test case.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setError('')
    try {
      await request<void>(`/admin/problems/${id}/test-cases/${deleteTarget.id}`, { method: 'DELETE' })
      setNotice(`Đã xóa “${deleteTarget.name}”.`)
      setDeleteTarget(null)
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể xóa test case.')
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
        <button className={styles.buttonSecondary} type="button" onClick={() => { setLoading(true); setError(''); void load() }}>Thử lại</button>
        <Link className={styles.buttonSecondary} to="/admin/problems">Quay lại danh sách</Link>
      </section>
    )
  }

  return (
    <>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>BÀI TẬP / {problem.code}</p><h1>Quản lý test case</h1><p className={styles.pageSubtitle}>{problem.title} · {cases.length} test case đã lưu.</p></div>
        <div className={styles.rowActions}>
          <Link className={styles.buttonSecondary} to={`/admin/problems/${problem.id}/edit`}><AdminIcon name="edit" /> Sửa bài tập</Link>
          <button className={styles.buttonPrimary} type="button" onClick={startNew}><AdminIcon name="plus" /> Thêm test case</button>
        </div>
      </div>
      <div className={styles.demoNotice} role="note">
        <AdminIcon name="lock" size={16} />
        <span>Test case được tải qua API chỉ dành cho Admin. API học viên chỉ trả về ví dụ công khai, không bao giờ trả dữ liệu test ẩn.</span>
      </div>
      {error && <p className={styles.formMessage} role="alert">{error}</p>}
      {formOpen && (
        <form className={styles.testForm} onSubmit={(event) => void save(event)}>
          <h2>{editingId ? 'Chỉnh sửa test case' : 'Thêm test case'}</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="case-name">Tên test case <span className={styles.requiredMark}>*</span></label>
              <input id="case-name" required maxLength={100} autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="case-kind">Loại test case</label>
              <select id="case-kind" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as TestCaseKind }))}>
                <option value="sample">Ví dụ công khai</option>
                <option value="hidden">Test ẩn</option>
              </select>
            </div>
            <div className={`${styles.field} ${styles.codeField}`}>
              <label htmlFor="case-input">Input</label>
              <textarea id="case-input" rows={6} value={draft.input} onChange={(event) => setDraft((current) => ({ ...current, input: event.target.value }))} />
              <p className={styles.fieldHint}>Có thể để trống nếu bài toán không cần dữ liệu đầu vào.</p>
            </div>
            <div className={`${styles.field} ${styles.codeField}`}>
              <label htmlFor="case-output">Expected output <span className={styles.requiredMark}>*</span></label>
              <textarea id="case-output" required rows={6} value={draft.expectedOutput} onChange={(event) => setDraft((current) => ({ ...current, expectedOutput: event.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="case-points">Điểm (không bắt buộc)</label>
              <input id="case-points" type="number" min="0" max="1000" step="1" value={draft.points ?? ''} onChange={(event) => setDraft((current) => ({ ...current, points: event.target.value === '' ? null : Number(event.target.value) }))} />
            </div>
          </div>
          <div className={styles.rowActions}>
            <button className={styles.buttonSecondary} type="button" disabled={busy} onClick={() => { setFormOpen(false); setError('') }}>Hủy</button>
            <button className={styles.buttonPrimary} type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu test case'}</button>
          </div>
        </form>
      )}
      {cases.length === 0 ? (
        <section className={`${styles.panel} ${styles.emptyState}`}>
          <h2>Chưa có test case</h2>
          <p>Thêm ví dụ công khai hoặc test ẩn cho bài tập.</p>
          <button className={styles.buttonSecondary} type="button" onClick={startNew}><AdminIcon name="plus" /> Thêm test case</button>
        </section>
      ) : (
        <section className={styles.testCaseGrid} aria-label="Danh sách test case">
          {cases.map((testCase) => (
            <article className={styles.testCaseCard} key={testCase.id}>
              <div className={styles.testCardHeader}>
                <div><strong>{testCase.name}</strong><small>{testCase.points === null ? 'Chưa gán điểm' : `${testCase.points} điểm`}</small></div>
                <span className={`${styles.badge} ${testCase.kind === 'sample' ? styles.kindSample : styles.kindHidden}`}>
                  {testCase.kind === 'sample' ? 'Ví dụ công khai' : <span className={styles.privacyLabel}><AdminIcon name="lock" size={12} /> Test ẩn</span>}
                </span>
              </div>
              <div><span className={styles.fieldLabel}>Input</span><pre className={styles.codePreview}>{testCase.input || '(Input rỗng — hợp lệ)'}</pre></div>
              <div className={styles.caseOutput}><span className={styles.fieldLabel}>Expected output</span><pre className={styles.codePreview}>{testCase.expectedOutput}</pre></div>
              <div className={`${styles.rowActions} ${styles.caseActions}`}>
                <button className={styles.iconButton} type="button" onClick={() => startEdit(testCase)}><AdminIcon name="edit" size={14} /> Sửa</button>
                <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} type="button" aria-label={`Xóa test case ${testCase.name}`} onClick={() => setDeleteTarget(testCase)}><AdminIcon name="trash" size={14} /> Xóa</button>
              </div>
            </article>
          ))}
        </section>
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Xóa test case?"
          description={`“${deleteTarget.name}” sẽ bị xóa khỏi cơ sở dữ liệu.`}
          confirmLabel="Xóa test case"
          danger
          onConfirm={() => void confirmDelete()}
          onCancel={() => !busy && setDeleteTarget(null)}
        />
      )}
    </>
  )
}

export default AdminTestCasesPage
