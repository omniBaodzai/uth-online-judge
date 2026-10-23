import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import MultiValuePicker from '../components/MultiValuePicker'
import { difficultyLabels } from '../utils'
import type { AdminCatalog, AdminProblem, AdminDifficulty, ProblemDraft, ProblemExample } from '../types'
import styles from '../admin.module.css'

const difficultyOptions: AdminDifficulty[] = ['easy', 'medium', 'hard']

function emptyDraft(): ProblemDraft {
  return {
    code: 'UTH011',
    title: '',
    summary: '',
    statement: '',
    difficulty: 'easy',
    tags: [],
    languages: [],
    inputDescription: '',
    outputDescription: '',
    constraints: '',
    timeLimitSeconds: 1,
    memoryLimitMb: 256,
    examples: [{ id: `example-${crypto.randomUUID()}`, input: '', output: '' }],
    status: 'draft',
  }
}

function toDraft(problem: AdminProblem): ProblemDraft {
  const { id, updatedAt, ...draft } = problem
  void id
  void updatedAt
  return draft
}

function AdminProblemFormPage() {
  const { id } = useParams()
  const { request } = useAdmin()
  const [problem, setProblem] = useState<AdminProblem>()
  const [catalog, setCatalog] = useState<AdminCatalog>({ tags: [], languages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(() => Promise.all([
        request<AdminCatalog>('/admin/catalog'),
        id ? request<AdminProblem>(`/admin/problems/${id}`) : Promise.resolve(undefined),
      ]), [id, request])

  const load = useCallback(async () => {
    try {
      const [nextCatalog, nextProblem] = await fetchData()
      setCatalog(nextCatalog)
      setProblem(nextProblem)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải dữ liệu biểu mẫu.')
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData().then(([nextCatalog, nextProblem]) => {
      if (!active) return
      setCatalog(nextCatalog)
      setProblem(nextProblem)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError ? cause.message : 'Không thể tải dữ liệu biểu mẫu.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [fetchData])

  if (loading) return <p className={styles.emptyState} aria-live="polite">Đang tải biểu mẫu…</p>
  if (error) {
    return <section className={styles.panel} role="alert"><h1>Không thể tải dữ liệu</h1><p>{error}</p><button className={styles.buttonSecondary} type="button" onClick={() => { setLoading(true); setError(''); void load() }}>Thử lại</button></section>
  }

  if (id && !problem) {
    return (
      <section className={styles.panel}>
        <h1>Không tìm thấy bài tập</h1>
        <p className={styles.pageSubtitle}>Bài tập không tồn tại hoặc đã bị xóa.</p>
        <Link className={styles.buttonSecondary} to="/admin/problems">Quay lại danh sách</Link>
      </section>
    )
  }

  return <ProblemForm key={problem?.id ?? 'new-problem'} problem={problem} tagOptions={catalog.tags} languageOptions={catalog.languages} />
}

function ProblemForm({ problem, tagOptions, languageOptions }: { problem?: AdminProblem; tagOptions: string[]; languageOptions: string[] }) {
  const navigate = useNavigate()
  const { request, setNotice } = useAdmin()
  const [initialDraft] = useState<ProblemDraft>(() => problem ? toDraft(problem) : emptyDraft())
  const [draft, setDraft] = useState<ProblemDraft>(initialDraft)
  const [codeError, setCodeError] = useState('')
  const [pendingPublish, setPendingPublish] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)

  useEffect(() => {
    if (!dirty) return
    function preventAccidentalClose(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventAccidentalClose)
    return () => window.removeEventListener('beforeunload', preventAccidentalClose)
  }, [dirty])

  function update<K extends keyof ProblemDraft>(key: K, value: ProblemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateExample(id: string, key: 'input' | 'output', value: string) {
    setDraft((current) => ({
      ...current,
      examples: current.examples.map((example) => example.id === id ? { ...example, [key]: value } : example),
    }))
  }

  function addExample() {
    update('examples', [...draft.examples, { id: `example-${crypto.randomUUID()}`, input: '', output: '' }])
  }

  function removeExample(id: string) {
    update('examples', draft.examples.filter((example) => example.id !== id))
  }

  async function persist(status: 'draft' | 'published') {
    const cleanDraft: ProblemDraft = {
      ...draft,
      code: draft.code.trim().toUpperCase(),
      title: draft.title.trim(),
      summary: draft.summary?.trim() || null,
      examples: draft.examples.map((example: ProblemExample) => ({ ...example })),
      status,
    }
    if (!/^UTH\d{3,}$/.test(cleanDraft.code)) {
      setCodeError('Mã bài cần theo định dạng UTH theo sau bởi ít nhất 3 chữ số.')
      document.getElementById('problem-code')?.focus()
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const saved = await request<AdminProblem>(
        problem ? `/admin/problems/${problem.id}` : '/admin/problems',
        {
          method: problem ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...cleanDraft,
            examples: cleanDraft.examples
              .filter(({ input, output }) => input !== '' || output !== '')
              .map(({ input, output }) => ({ input, output })),
          }),
        },
      )
      setNotice(`Đã lưu “${saved.code}” vào hệ thống.`)
      navigate('/admin/problems')
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : 'Không thể lưu bài tập. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>, status: 'draft' | 'published') {
    event.preventDefault()
    setCodeError('')
    if (status === 'published') setPendingPublish(true)
    else void persist('draft')
  }

  function cancel() {
    if (dirty) setConfirmLeave(true)
    else navigate('/admin/problems')
  }

  return (
    <>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>NGÂN HÀNG BÀI TẬP</p><h1>{problem ? 'Chỉnh sửa bài tập' : 'Tạo bài tập mới'}</h1><p className={styles.pageSubtitle}>{problem ? `Đang chỉnh sửa ${problem.code}.` : 'Điền thông tin bài tập để lưu lên hệ thống.'}</p></div>
        <Link className={styles.buttonSecondary} to="/admin/problems">← Danh sách bài tập</Link>
      </div>
      <form id="admin-problem-form" onSubmit={(event) => submit(event, 'draft')}>
        <section className={`${styles.panel} ${styles.formSection}`}>
          <h2>Thông tin cơ bản</h2>
          <p className={styles.sectionHint}>Tên, mã nhận diện và nội dung chính của đề bài.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="problem-title">Tên bài tập <span className={styles.requiredMark}>*</span></label>
              <input id="problem-title" required maxLength={140} value={draft.title} onChange={(event) => update('title', event.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="problem-code">Mã bài <span className={styles.requiredMark}>*</span></label>
              <input
                id="problem-code"
                required
                pattern="UTH[0-9]{3,}"
                title="Mã bài có định dạng UTH theo sau bởi ít nhất 3 chữ số."
                aria-describedby={codeError ? 'problem-code-error' : 'problem-code-hint'}
                value={draft.code}
                onChange={(event) => { update('code', event.target.value.toUpperCase()); setCodeError('') }}
              />
              {codeError ? <p id="problem-code-error" className={styles.fieldError} role="alert">{codeError}</p> : <p id="problem-code-hint" className={styles.fieldHint}>Ví dụ: UTH001. Mã bài phải duy nhất.</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="problem-summary">Mô tả ngắn</label>
              <input id="problem-summary" maxLength={200} value={draft.summary ?? ''} onChange={(event) => update('summary', event.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor="problem-difficulty">Độ khó <span className={styles.requiredMark}>*</span></label>
              <select id="problem-difficulty" value={draft.difficulty} onChange={(event) => update('difficulty', event.target.value as AdminDifficulty)}>
                {difficultyOptions.map((item) => <option key={item} value={item}>{difficultyLabels[item]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="problem-statement">Đề bài <span className={styles.requiredMark}>*</span></label>
              <textarea id="problem-statement" required rows={5} value={draft.statement} onChange={(event) => update('statement', event.target.value)} />
            </div>
            <MultiValuePicker
              label="Chủ đề / tag"
              placeholder="Nhập chủ đề, ví dụ: Quy hoạch động"
              suggestions={tagOptions}
              values={draft.tags}
              onChange={(values) => update('tags', values)}
            />
            <MultiValuePicker
              label="Ngôn ngữ hỗ trợ"
              placeholder="Nhập ngôn ngữ, ví dụ: Rust"
              suggestions={languageOptions}
              values={draft.languages}
              onChange={(values) => update('languages', values)}
              allowCustom={false}
            />
            {languageOptions.length === 0 && (
              <p className={styles.fieldHint} role="status">
                Chưa có ngôn ngữ nào được bật. Hãy cấu hình các ngôn ngữ hỗ trợ trong cơ sở dữ liệu trước khi gắn chúng vào bài tập.
              </p>
            )}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.formSection}`}>
          <h2>Đặc tả đầu vào / đầu ra</h2>
          <p className={styles.sectionHint}>Thêm mô tả và các ví dụ công khai để minh họa định dạng.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="input-description">Mô tả đầu vào <span className={styles.requiredMark}>*</span></label><textarea id="input-description" required value={draft.inputDescription} onChange={(event) => update('inputDescription', event.target.value)} /></div>
            <div className={styles.field}><label htmlFor="output-description">Mô tả đầu ra <span className={styles.requiredMark}>*</span></label><textarea id="output-description" required value={draft.outputDescription} onChange={(event) => update('outputDescription', event.target.value)} /></div>
          </div>
          <div className={styles.panelHeading}>
            <div><h2>Ví dụ mẫu</h2><p>Input và output dùng kiểu chữ monospace.</p></div>
            <button className={styles.buttonSecondary} type="button" onClick={addExample}><AdminIcon name="plus" size={16} /> Thêm ví dụ</button>
          </div>
          <div className={styles.formStack}>
            {draft.examples.map((example, index) => (
              <article className={styles.exampleCard} key={example.id}>
                <div className={styles.exampleHeader}><strong>Ví dụ {index + 1}</strong>{draft.examples.length > 1 && <button className={`${styles.iconButton} ${styles.iconButtonDanger}`} type="button" onClick={() => removeExample(example.id)}><AdminIcon name="trash" size={14} /> Xóa ví dụ</button>}</div>
                <div className={styles.exampleFields}>
                  <div className={`${styles.field} ${styles.codeField}`}><label htmlFor={`${example.id}-input`}>Sample input</label><textarea id={`${example.id}-input`} rows={4} value={example.input} onChange={(event) => updateExample(example.id, 'input', event.target.value)} /></div>
                  <div className={`${styles.field} ${styles.codeField}`}><label htmlFor={`${example.id}-output`}>Expected output</label><textarea id={`${example.id}-output`} rows={4} value={example.output} onChange={(event) => updateExample(example.id, 'output', event.target.value)} /></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.formSection}`}>
          <h2>Ràng buộc và giới hạn chấm</h2>
          <p className={styles.sectionHint}>Các giới hạn này được lưu cùng bài tập và sẽ dùng cho hệ thống chấm ở giai đoạn tích hợp tiếp theo.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}><label htmlFor="constraints">Ràng buộc</label><textarea id="constraints" rows={3} value={draft.constraints} onChange={(event) => update('constraints', event.target.value)} /></div>
            <div className={styles.formGrid}>
              <div className={styles.field}><label htmlFor="time-limit">Giới hạn thời gian (giây) <span className={styles.requiredMark}>*</span></label><input id="time-limit" type="number" min="0.1" max="30" step="0.1" required value={draft.timeLimitSeconds} onChange={(event) => update('timeLimitSeconds', Number(event.target.value))} /></div>
              <div className={styles.field}><label htmlFor="memory-limit">Bộ nhớ (MB) <span className={styles.requiredMark}>*</span></label><input id="memory-limit" type="number" min="16" max="8192" step="16" required value={draft.memoryLimitMb} onChange={(event) => update('memoryLimitMb', Number(event.target.value))} /></div>
            </div>
          </div>
        </section>
        {saveError && <p className={styles.formMessage} role="alert">{saveError}</p>}
        <div className={styles.formActions}>
          <button className={styles.buttonSecondary} type="button" onClick={cancel}>Hủy</button>
          <button className={styles.buttonSecondary} type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu bản nháp'}</button>
          <button className={styles.buttonPrimary} type="button" onClick={() => {
            const form = document.getElementById('admin-problem-form')
            if (form instanceof HTMLFormElement && form.reportValidity()) {
              setCodeError('')
              setPendingPublish(true)
            }
          }}>Xuất bản</button>
        </div>
      </form>
      {pendingPublish && (
        <ConfirmDialog
          title="Xuất bản bài tập demo?"
          description={`“${draft.code} — ${draft.title || 'Bài tập mới'}” sẽ được lưu và xuất bản trên hệ thống.`}
          confirmLabel="Xuất bản"
          onConfirm={() => { setPendingPublish(false); void persist('published') }}
          onCancel={() => setPendingPublish(false)}
        />
      )}
      {confirmLeave && (
        <ConfirmDialog
          title="Rời khỏi biểu mẫu?"
          description="Các thay đổi chưa lưu trong biểu mẫu này sẽ bị mất."
          confirmLabel="Rời khỏi"
          danger
          onConfirm={() => navigate('/admin/problems')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  )
}

export default AdminProblemFormPage
