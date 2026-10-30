import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../auth/api'
import { useAdmin } from '../useAdmin'
import { monacoLanguageId } from '../../problems/submit/languages'
import { ConfirmDialog } from '../components/ConfirmDialog'
import MultiValuePicker from '../components/MultiValuePicker'
import TestCaseCollectionEditor from '../components/TestCaseCollectionEditor'
import MarkdownEditorField from '../components/MarkdownEditorField'
import ProblemIllustrationEditor from '../components/ProblemIllustrationEditor'
import { validateProblemCode } from '../utils'
import type {
  AdminCatalog,
  AdminProblem,
  AdminTestCaseCollection,
  AdminTestCaseDraft,
  ProblemDraft,
} from '../types'
import styles from '../admin.module.css'

function emptyDraft(): ProblemDraft {
  return {
    code: 'uth011',
    title: '',
    summary: '',
    illustrationUrl: null,
    illustrationWidth: 100,
    illustrationAspectRatio: 'auto',
    illustrationAlignment: 'center',
    statement: '',
    difficulty: undefined,
    tags: [],
    languages: [],
    inputDescription: '',
    outputDescription: '',
    constraints: '',
    timeLimitSeconds: 1,
    memoryLimitMb: 256,
    scoringEnabled: false,
    score: 1,
    testCases: [],
    testCaseRevision: 0,
    editorials: [],
    status: 'draft',
  }
}

const editorReady = () => {}
const MonacoEditor = lazy(() => import('../../problems/submit/MonacoEditor'))

function toDraft(problem: AdminProblem, collection: AdminTestCaseCollection): ProblemDraft {
  const { id, updatedAt, examples, testCaseRevision, ...draft } = problem
  void id
  void updatedAt
  void examples
  return {
    ...draft,
    illustrationUrl: draft.illustrationUrl ?? null,
    illustrationWidth: draft.illustrationWidth ?? 100,
    illustrationAspectRatio: draft.illustrationAspectRatio ?? 'auto',
    illustrationAlignment: draft.illustrationAlignment ?? 'center',
    testCases: collection.cases.map((testCase) => ({
      id: testCase.id,
      clientId: testCase.id,
      name: testCase.name,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      kind: testCase.kind,
    })),
    testCaseRevision: collection.revision ?? testCaseRevision,
  }
}

function AdminProblemFormPage() {
  const { id } = useParams()
  const { request } = useAdmin()
  const [problem, setProblem] = useState<AdminProblem>()
  const [testCases, setTestCases] = useState<AdminTestCaseCollection>({ revision: 0, cases: [] })
  const [catalog, setCatalog] = useState<AdminCatalog>({ tags: [], languages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(() => Promise.all([
        request<AdminCatalog>('/admin/catalog'),
        id ? request<AdminProblem>(`/admin/problems/${id}`) : Promise.resolve(undefined),
        id
          ? request<AdminTestCaseCollection>(`/admin/problems/${id}/test-cases`)
          : Promise.resolve({ revision: 0, cases: [] }),
      ]), [id, request])

  const load = useCallback(async () => {
    try {
      const [nextCatalog, nextProblem, nextCases] = await fetchData()
      setCatalog(nextCatalog)
      setProblem(nextProblem)
      setTestCases(nextCases)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể tải dữ liệu biểu mẫu.')
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData().then(([nextCatalog, nextProblem, nextCases]) => {
      if (!active) return
      setCatalog(nextCatalog)
      setProblem(nextProblem)
      setTestCases(nextCases)
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

  return <ProblemForm key={problem?.id ?? 'new-problem'} problem={problem} initialTestCases={testCases} tagOptions={catalog.tags} languageOptions={catalog.languages} />
}

function ProblemForm({ problem, initialTestCases, tagOptions, languageOptions }: {
  problem?: AdminProblem
  initialTestCases: AdminTestCaseCollection
  tagOptions: string[]
  languageOptions: string[]
}) {
  const navigate = useNavigate()
  const { request, setNotice } = useAdmin()
  const [initialDraft] = useState<ProblemDraft>(() => problem
    ? toDraft(problem, initialTestCases)
    : { ...emptyDraft(), testCaseRevision: initialTestCases.revision })
  const [draft, setDraft] = useState<ProblemDraft>(initialDraft)
  const [configuredLanguages, setConfiguredLanguages] = useState(languageOptions)
  const [codeError, setCodeError] = useState('')
  const [pendingPublish, setPendingPublish] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingIllustration, setUploadingIllustration] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editorRevision, setEditorRevision] = useState(0)
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

  function updateEditorial(index: number, field: 'title' | 'language' | 'sourceCode', value: string) {
    setDraft((current) => ({
      ...current,
      editorials: current.editorials.map((editorial, currentIndex) => (
        currentIndex === index ? { ...editorial, [field]: value } : editorial
      )),
    }))
    setEditorRevision((revision) => revision + 1)
  }

  async function persist(status: 'draft' | 'published') {
    const cleanDraft: ProblemDraft = {
      ...draft,
      code: draft.code.trim(),
      title: draft.title.trim(),
      summary: draft.summary?.trim() || null,
      illustrationUrl: draft.illustrationUrl?.trim() || null,
      testCases: draft.testCases.map((testCase: AdminTestCaseDraft) => ({ ...testCase })),
      status,
    }
    const codeMessage = validateProblemCode(cleanDraft.code)
    if (codeMessage) {
      setCodeError(codeMessage)
      document.getElementById('problem-code')?.focus()
      return
    }
    if (cleanDraft.testCases.some((testCase) => !testCase.name.trim() || testCase.expectedOutput.length === 0)) {
      setSaveError('Vui lòng nhập tên và đầu ra mong đợi cho mọi test case.')
      return
    }
    if (cleanDraft.editorials.some((editorial) => (
      !editorial.title.trim() || !editorial.language.trim() || !editorial.sourceCode.trim()
    ))) {
      setSaveError('Vui lòng nhập tiêu đề, ngôn ngữ và mã nguồn cho mọi lời giải.')
      return
    }
    if (status === 'published' && cleanDraft.testCases.length === 0) {
      setSaveError('Thêm ít nhất một test case trước khi xuất bản bài tập.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const { testCaseRevision, ...requestDraft } = cleanDraft
      const saved = await request<AdminProblem>(
        problem ? `/admin/problems/${problem.id}` : '/admin/problems',
        {
          method: problem ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...requestDraft,
            difficulty: cleanDraft.difficulty ?? 'easy',
            scoringEnabled: false,
            score: 1,
            testCasesRevision: testCaseRevision,
            testCases: cleanDraft.testCases.map(({ id, name, input, expectedOutput, kind }) => ({
              ...(id ? { id } : {}),
              name: name.trim(),
              input,
              expectedOutput,
              kind,
              points: 1,
            })),
            editorials: cleanDraft.editorials.map(({ id, title, language, sourceCode }) => ({
              ...(id ? { id } : {}),
              title: title.trim(),
              language: language.trim(),
              sourceCode,
            })),
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
    if (uploadingIllustration) {
      setSaveError('Vui lòng đợi tải ảnh minh họa hoàn tất trước khi lưu.')
      return
    }
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
            <div className={`${styles.field} ${styles.formFullWidth}`}>
              <span className={styles.fieldLabel}>Hình ảnh minh họa</span>
              <ProblemIllustrationEditor
                settings={{
                  illustrationUrl: draft.illustrationUrl,
                  illustrationWidth: draft.illustrationWidth,
                  illustrationAspectRatio: draft.illustrationAspectRatio,
                  illustrationAlignment: draft.illustrationAlignment,
                }}
                onChange={(settings) => setDraft((current) => ({ ...current, ...settings }))}
                onUploadingChange={setUploadingIllustration}
              />
            </div>
            <MarkdownEditorField
              id="problem-statement"
              label="Đề bài"
              required
              fullWidth
              rows={7}
              value={draft.statement}
              onChange={(value) => update('statement', value)}
            />
            <MultiValuePicker
              label="Chủ đề"
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
          <p className={styles.sectionHint}>Thêm mô tả định dạng và quản lý toàn bộ test dùng cho minh họa lẫn chấm điểm.</p>
          <div className={styles.formGrid}>
            <MarkdownEditorField
              id="input-description"
              label="Mô tả đầu vào"
              required
              value={draft.inputDescription}
              onChange={(value) => update('inputDescription', value)}
            />
            <MarkdownEditorField
              id="output-description"
              label="Mô tả đầu ra"
              required
              value={draft.outputDescription}
              onChange={(value) => update('outputDescription', value)}
            />
          </div>
          <TestCaseCollectionEditor
            cases={draft.testCases}
            onChange={(testCases) => update('testCases', testCases)}
            disabled={saving}
          />
        </section>

        <section className={`${styles.panel} ${styles.formSection}`}>
          <h2>Ràng buộc và giới hạn chấm</h2>
          <p className={styles.sectionHint}>Mọi bài tập đều sử dụng thang điểm cố định 1 điểm cho mỗi test case. Chỉ cần nhập các giới hạn thời gian và bộ nhớ.</p>
          <div className={styles.formGrid}>
            <MarkdownEditorField
              id="constraints"
              label="Ràng buộc"
              rows={4}
              value={draft.constraints}
              onChange={(value) => update('constraints', value)}
            />
            <div className={styles.formGrid}>
              <div className={styles.field}><label htmlFor="time-limit">Giới hạn thời gian (giây) <span className={styles.requiredMark}>*</span></label><input id="time-limit" type="number" min="0.1" max="30" step="0.1" required value={draft.timeLimitSeconds} onChange={(event) => update('timeLimitSeconds', Number(event.target.value))} /></div>
              <div className={styles.field}><label htmlFor="memory-limit">Bộ nhớ (MB) <span className={styles.requiredMark}>*</span></label><input id="memory-limit" type="number" min="16" max="8192" step="16" required value={draft.memoryLimitMb} onChange={(event) => update('memoryLimitMb', Number(event.target.value))} /></div>
            </div>
          </div>
        </section>
        <section className={`${styles.panel} ${styles.formSection}`}>
          <div className={styles.editorialHeading}>
            <div>
              <h2>Lời giải bài tập</h2>
              <p className={styles.sectionHint}>Không bắt buộc. Chỉ hiển thị sau khi người học có ít nhất một kết quả chấm cuối cùng.</p>
            </div>
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={saving}
              onClick={() => update('editorials', [
                ...draft.editorials,
                {
                  title: `Lời giải ${draft.editorials.length + 1}`,
                  language: draft.languages[0] ?? configuredLanguages[0] ?? 'C++',
                  sourceCode: '',
                },
              ])}
            >
              Thêm lời giải
            </button>
          </div>
          {draft.editorials.length === 0 ? (
            <p className={styles.fieldHint}>Bài tập chưa có lời giải. Bạn có thể thêm một lời giải cho mỗi ngôn ngữ.</p>
          ) : (
            <div className={styles.editorialList}>
              {draft.editorials.map((editorial, index) => {
                const languageOptions = [...new Set([...configuredLanguages, editorial.language].filter(Boolean))]
                return (
                  <article className={styles.editorialCard} key={editorial.id ?? `editorial-${index}`}>
                    <div className={styles.editorialHeading}>
                      <h3>Lời giải {index + 1}</h3>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        disabled={saving}
                        onClick={() => update('editorials', draft.editorials.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        Xóa lời giải
                      </button>
                    </div>
                    <div className={styles.editorialFields}>
                      <div className={styles.field}>
                        <label htmlFor={`editorial-title-${index}`}>Tiêu đề</label>
                        <input
                          id={`editorial-title-${index}`}
                          maxLength={160}
                          value={editorial.title}
                          disabled={saving}
                          onChange={(event) => updateEditorial(index, 'title', event.target.value)}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor={`editorial-language-${index}`}>Ngôn ngữ lập trình</label>
                        <select
                          id={`editorial-language-${index}`}
                          value={editorial.language}
                          disabled={saving}
                          onChange={(event) => updateEditorial(index, 'language', event.target.value)}
                        >
                          {languageOptions.map((language) => <option key={language} value={language}>{language}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label>Mã nguồn lời giải</label>
                      <div className={styles.editorialCodeEditor}>
                        <Suspense fallback={<div className={styles.editorialEditorLoading} role="status">Đang tải trình soạn thảo…</div>}>
                          <MonacoEditor
                            value={editorial.sourceCode}
                            language={monacoLanguageId(editorial.language)}
                            revision={editorRevision}
                            ariaLabel={`Mã nguồn lời giải ${index + 1}`}
                            onChange={(sourceCode) => updateEditorial(index, 'sourceCode', sourceCode)}
                            onReady={editorReady}
                          />
                        </Suspense>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        {saveError && <p className={styles.formMessage} role="alert">{saveError}</p>}
        <div className={styles.formActions}>
          <button className={styles.buttonSecondary} type="button" onClick={cancel} disabled={saving || uploadingIllustration}>Hủy</button>
          <button className={styles.buttonSecondary} type="submit" disabled={saving || uploadingIllustration}>{saving ? 'Đang lưu…' : uploadingIllustration ? 'Đang tải ảnh…' : 'Lưu bản nháp'}</button>
          <button className={styles.buttonPrimary} type="button" disabled={saving || uploadingIllustration} onClick={() => {
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
