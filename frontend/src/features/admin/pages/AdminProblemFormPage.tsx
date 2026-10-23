import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { AdminIcon } from '../components/AdminIcons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import MultiValuePicker from '../components/MultiValuePicker'
import { difficultyLabels, validateProblemCode } from '../utils'
import type { AdminCatalog, AdminProblem, AdminDifficulty, ProblemDraft, ProblemExample } from '../types'
import styles from '../admin.module.css'

const difficultyOptions: AdminDifficulty[] = ['easy', 'medium', 'hard']

function emptyDraft(): ProblemDraft {
  return {
    code: 'uth011',
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
    scoringEnabled: false,
    score: 100,
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
  const [configuredLanguages, setConfiguredLanguages] = useState(languageOptions)
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
      code: draft.code.trim(),
      title: draft.title.trim(),
      summary: draft.summary?.trim() || null,
      examples: draft.examples.map((example: ProblemExample) => ({ ...example })),
      status,
    }
    const codeMessage = validateProblemCode(cleanDraft.code)
    if (codeMessage) {
      setCodeError(codeMessage)
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
                maxLength={50}
                aria-describedby={codeError ? 'problem-code-error' : 'problem-code-hint'}
                value={draft.code}
                onChange={(event) => { update('code', event.target.value); setCodeError('') }}
              />
              {codeError ? <p id="problem-code-error" className={styles.fieldError} role="alert">{codeError}</p> : <p id="problem-code-hint" className={styles.fieldHint}>Chỉ gồm a-z, 0-9 và dấu _ (tối đa 50 ký tự). Ví dụ: uth011, tong_hai_so. Mã bài phải duy nhất.</p>}
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
              placeholder="Chọn ngôn ngữ đã bật"
              suggestions={configuredLanguages}
              values={draft.languages}
              onChange={(values) => update('languages', values)}
              allowCustom={false}
            />
            {configuredLanguages.length === 0 && (
              <p className={styles.fieldHint} role="status">
                Chưa có ngôn ngữ nào được bật. Tải danh sách từ Judge0 bên dưới để thêm ngôn ngữ hỗ trợ.
              </p>
            )}
            <Judge0LanguagePicker
              onAdded={(language) => {
                setConfiguredLanguages((current) => (
                  current.some((name) => name.toLocaleLowerCase() === language.name.toLocaleLowerCase())
                    ? current
                    : [...current, language.name].sort((left, right) => left.localeCompare(right))
                ))
                setDraft((current) => (
                  current.languages.some((name) => name.toLocaleLowerCase() === language.name.toLocaleLowerCase())
                    ? current
                    : { ...current, languages: [...current.languages, language.name] }
                ))
              }}
            />
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
          <p className={styles.sectionHint}>Bạn có thể chấm theo verdict mà không dùng điểm, hoặc bật tính điểm và phân bổ đủ trọng số cho test ẩn.</p>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="problem-scoring-enabled">
                <input
                  id="problem-scoring-enabled"
                  type="checkbox"
                  checked={draft.scoringEnabled}
                  onChange={(event) => update('scoringEnabled', event.target.checked)}
                />
                {' '}Áp dụng tính điểm
              </label>
              <p className={styles.fieldHint}>Khi tắt, bài vẫn được chấm verdict và test case bình thường. Các bài đã tồn tại giữ chế độ cũ sau migration; bỏ chọn mục này để không yêu cầu điểm test.</p>
            </div>
            {draft.scoringEnabled && (
              <div className={styles.field}>
                <label htmlFor="problem-score">Điểm tối đa <span className={styles.requiredMark}>*</span></label>
                <input
                  id="problem-score"
                  type="number"
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  required
                  value={draft.score}
                  onChange={(event) => update('score', Number(event.target.value))}
                />
                <p className={styles.fieldHint}>Tổng điểm các test ẩn phải khớp điểm tối đa. Có thể phân bổ thủ công hoặc dùng phân bổ đều.</p>
              </div>
            )}
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

type Judge0Language = { id: number; name: string; configured: boolean }
type EnabledLanguage = { judge0LanguageId: number; slug: string; name: string }

function Judge0LanguagePicker({ onAdded }: { onAdded: (language: EnabledLanguage) => void }) {
  const { request } = useAdmin()
  const [languages, setLanguages] = useState<Judge0Language[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const selected = languages.find((language) => String(language.id) === selectedId)

  useEffect(() => {
    let active = true
    request<Judge0Language[]>('/admin/languages/judge0')
      .then((result) => {
        if (active) setLanguages(result)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError
            ? cause.message
            : 'Không thể tải danh sách ngôn ngữ từ Judge0.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [request, reloadKey])

  async function enableSelectedLanguage() {
    if (!selected || selected.configured) return
    setAdding(true)
    setError('')
    setNotice('')
    try {
      const enabled = await request<EnabledLanguage>('/admin/languages', {
        method: 'POST',
        body: JSON.stringify({ judge0LanguageId: selected.id }),
      })
      setLanguages((current) => current.map((language) => (
        language.id === enabled.judge0LanguageId ? { ...language, configured: true } : language
      )))
      onAdded(enabled)
      setNotice(`Đã bật ${enabled.name} và thêm vào danh sách ngôn ngữ của bài.`)
      setSelectedId('')
    } catch (cause) {
      setError(cause instanceof ApiError
        ? cause.message
        : 'Không thể bật ngôn ngữ. Vui lòng thử lại.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor="judge0-language-select">Thêm ngôn ngữ từ Judge0</label>
      {loading ? (
        <p className={styles.fieldHint} role="status">Đang tải danh sách ngôn ngữ…</p>
      ) : (
        <>
          {languages.length > 0 && (
            <select
              id="judge0-language-select"
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setNotice('')
              }}
              disabled={adding}
            >
              <option value="">Chọn ngôn ngữ Judge0</option>
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name} (Judge0 #{language.id}){language.configured ? ' — đã bật' : ''}
                </option>
              ))}
            </select>
          )}
          {languages.length === 0 && !error && (
            <p className={styles.fieldHint} role="status">Judge0 hiện không cung cấp ngôn ngữ nào.</p>
          )}
          {selected?.configured && (
            <p className={styles.fieldHint}>Ngôn ngữ này đã bật trong hệ thống; hãy chọn ở danh sách phía trên.</p>
          )}
          {selected && !selected.configured && (
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={() => void enableSelectedLanguage()}
              disabled={adding}
            >
              {adding ? 'Đang bật…' : 'Bật và thêm vào bài này'}
            </button>
          )}
        </>
      )}
      <p className={styles.fieldHint}>
        Danh sách được lấy trực tiếp từ Judge0; mỗi mã Judge0 được ánh xạ sang slug ứng dụng lưu trong cơ sở dữ liệu.
      </p>
      {error && (
        <div>
          <p className={styles.fieldError} role="alert">{error}</p>
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={() => {
              setLoading(true)
              setError('')
              setNotice('')
              setReloadKey((key) => key + 1)
            }}
            disabled={loading || adding}
          >
            Tải lại danh sách
          </button>
        </div>
      )}
      {notice && <p className={styles.fieldHint} role="status">{notice}</p>}
    </div>
  )
}

export default AdminProblemFormPage
