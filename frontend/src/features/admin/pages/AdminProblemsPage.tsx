import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import AdminLayout from '../AdminLayout'
import { buildQuery, describeError, formatDate, useAdminQuery, type Paged } from '../api'
import { Modal, Notice, Pager } from '../components'
import styles from '../admin.module.css'

type ProblemRow = { id: string; code: string; title: string; timeLimitSeconds: number; memoryLimitMb: number; totalScore: number; testCount: number; submissionCount: number; createdAt: string }
type TestCase = { input: string; expectedOutput: string; isSample: boolean }
type ProblemForm = {
  id?: string; code: string; title: string; timeLimitSeconds: number; memoryLimitMb: number; totalScore: number
  topic: string; tags: string[]; difficulty: 'Dễ' | 'Trung bình' | 'Khó'
  description: string; inputSpec: string; outputSpec: string; constraintsText: string; source: string
  testCases: TestCase[]
}

const emptyForm: ProblemForm = {
  code: '', title: '', timeLimitSeconds: 1, memoryLimitMb: 256, totalScore: 100,
  topic: '', tags: [], difficulty: 'Trung bình', description: '', inputSpec: '', outputSpec: '', constraintsText: '', source: '',
  testCases: [{ input: '', expectedOutput: '', isSample: true }],
}

function ProblemEditor({ initial, onClose, onSaved }: { initial: ProblemForm; onClose: () => void; onSaved: () => void }) {
  const { request } = useAuth()
  const [form, setForm] = useState(initial)
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const setTest = (index: number, patch: Partial<TestCase>) =>
    setForm((current) => ({ ...current, testCases: current.testCases.map((test, i) => (i === index ? { ...test, ...patch } : test)) }))

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { id, ...body } = form
      const tags = tagsText.split(',').map((tag) => tag.trim()).filter(Boolean)
      await request(id ? `/api/admin/problems/${id}` : '/api/admin/problems', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ ...body, tags, topic: body.topic.trim(), code: body.code.trim().toUpperCase(), title: body.title.trim() }) })
      onSaved()
    } catch (reason) {
      setError(describeError(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={form.id ? `Sửa bài ${form.code}` : 'Thêm bài tập'} onClose={onClose} wide>
      <Notice kind="error">{error}</Notice>
      <div className={styles.formGrid}>
        <label className={styles.field}>Mã bài<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} maxLength={30} /></label>
        <label className={styles.field}>Tên bài<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} /></label>
        <label className={styles.field}>Giới hạn thời gian (giây)<input type="number" min={0.1} max={30} step={0.1} value={form.timeLimitSeconds} onChange={(event) => setForm({ ...form, timeLimitSeconds: Number(event.target.value) })} /></label>
        <label className={styles.field}>Giới hạn bộ nhớ (MB)<input type="number" min={16} max={2048} value={form.memoryLimitMb} onChange={(event) => setForm({ ...form, memoryLimitMb: Number(event.target.value) })} /></label>
        <label className={styles.field}>Tổng điểm<input type="number" min={1} max={10000} value={form.totalScore} onChange={(event) => setForm({ ...form, totalScore: Number(event.target.value) })} /></label>
      </div>
      <h4>Nội dung đề bài (hiển thị cho người dùng)</h4>
      <div className={styles.formGrid}>
        <label className={styles.field}>Nhóm / chủ đề<input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} maxLength={100} placeholder="Ví dụ: Vòng lặp" /></label>
        <label className={styles.field}>Mức độ
          <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as ProblemForm['difficulty'] })}>
            <option>Dễ</option><option>Trung bình</option><option>Khó</option>
          </select>
        </label>
        <label className={styles.field}>Nhãn (cách nhau bằng dấu phẩy)<input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="Python cơ bản, Toán học" /></label>
        <label className={styles.field}>Nguồn bài<input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} maxLength={255} /></label>
      </div>
      <label className={styles.field}>Mô tả (mỗi dòng là một đoạn)<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
      <div className={styles.formGrid}>
        <label className={styles.field}>Đầu vào<textarea value={form.inputSpec} onChange={(event) => setForm({ ...form, inputSpec: event.target.value })} rows={3} /></label>
        <label className={styles.field}>Đầu ra<textarea value={form.outputSpec} onChange={(event) => setForm({ ...form, outputSpec: event.target.value })} rows={3} /></label>
      </div>
      <label className={styles.field}>Giới hạn (mỗi dòng một ràng buộc)<textarea value={form.constraintsText} onChange={(event) => setForm({ ...form, constraintsText: event.target.value })} rows={3} /></label>
      <h4>Test case ({form.testCases.length})</h4>
      {form.testCases.map((test, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Input<textarea className={styles.mono} value={test.input} onChange={(event) => setTest(index, { input: event.target.value })} /></label>
            <label className={styles.field}>Output mong đợi<textarea className={styles.mono} value={test.expectedOutput} onChange={(event) => setTest(index, { expectedOutput: event.target.value })} /></label>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.check}><input type="checkbox" checked={test.isSample} onChange={(event) => setTest(index, { isSample: event.target.checked })} />Test ví dụ (hiển thị công khai)</label>
            <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => setForm({ ...form, testCases: form.testCases.filter((_, i) => i !== index) })}>Xóa test</button>
          </div>
        </div>
      ))}
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setForm({ ...form, testCases: [...form.testCases, { input: '', expectedOutput: '', isSample: false }] })}>+ Thêm test case</button>
        <button type="button" className={styles.btn} disabled={saving} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu bài tập'}</button>
      </div>
    </Modal>
  )
}

export default function AdminProblemsPage() {
  const { request } = useAuth()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ProblemForm | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const list = useAdminQuery<Paged<ProblemRow>>(`/api/admin/problems${buildQuery({ search: query, page, pageSize: 15 })}`)

  async function open(id?: string) {
    setError('')
    if (!id) return setEditing(emptyForm)
    try {
      setEditing(await request<ProblemForm>(`/api/admin/problems/${id}`))
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  async function remove(row: ProblemRow) {
    if (!window.confirm(`Xóa bài ${row.code}? Toàn bộ test case${row.submissionCount ? ` và ${row.submissionCount} bài nộp` : ''} liên quan có thể bị xóa theo.`)) return
    try {
      await request(`/api/admin/problems/${row.id}`, { method: 'DELETE' })
      setMessage(`Đã xóa bài ${row.code}.`)
      list.reload()
    } catch (reason) {
      setError(describeError(reason))
    }
  }

  return (
    <AdminLayout title="Quản lý bài tập" subtitle="Thêm, sửa, xóa bài tập cùng bộ test case dùng để chấm.">
      <Notice kind="error">{error || list.error}</Notice>
      <Notice kind="success">{message}</Notice>
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}>
        <input type="search" placeholder="Tìm theo mã hoặc tên bài…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className={styles.btn} type="submit">Tìm</button>
        <button className={styles.btn} type="button" onClick={() => void open()}>+ Thêm bài tập</button>
      </form>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Mã</th><th>Tên bài</th><th>Thời gian / Bộ nhớ</th><th>Điểm</th><th>Test</th><th>Bài nộp</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead>
            <tbody>
              {list.data?.items.map((row) => (
                <tr key={row.id}>
                  <td><b>{row.code}</b></td><td>{row.title}</td><td>{row.timeLimitSeconds}s / {row.memoryLimitMb}MB</td>
                  <td>{row.totalScore}</td><td>{row.testCount}</td><td>{row.submissionCount}</td><td>{formatDate(row.createdAt)}</td>
                  <td><div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => void open(row.id)}>Sửa</button>
                    <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => void remove(row)}>Xóa</button>
                  </div></td>
                </tr>
              ))}
              {list.data?.items.length === 0 && <tr><td colSpan={8}>Không có bài tập.</td></tr>}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </section>
      {editing && <ProblemEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('Đã lưu bài tập.'); list.reload() }} />}
    </AdminLayout>
  )
}
