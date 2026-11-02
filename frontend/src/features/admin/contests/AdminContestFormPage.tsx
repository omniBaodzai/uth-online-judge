import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Check, Info, Plus, Search, Trash2, Trophy } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { AdminProblem } from '../types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AdminIcon } from '../components/AdminIcons'
import { useAdmin } from '../useAdmin'
import { contestErrorMessage } from './contest-errors'
import { useContestAdmin } from './useContestAdmin'
import {
  formatForDateTimeLocal,
  normalizeContestSearch,
  parseDateTimeLocal,
  suggestContestCode,
} from './contest-utils'
import type { ContestDetail, ContestFormValues, ContestProblem } from './types'
import adminStyles from '../admin.module.css'
import styles from './AdminContestsPage.module.css'

type FormErrors = Record<string, string>

const difficultyLabels = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
} as const

function emptyFormValues(): ContestFormValues {
  return {
    slug: '',
    title: '',
    description: '',
    rules: '',
    startsAt: '',
    endsAt: '',
    settings: {
      visibility: 'PUBLIC',
      allowRegistration: true,
      showLeaderboard: true,
    },
    problems: [],
  }
}

function toFormValues(contest: ContestDetail): ContestFormValues {
  return {
    slug: contest.slug,
    title: contest.title,
    description: contest.description ?? '',
    rules: contest.rules ?? '',
    startsAt: formatForDateTimeLocal(contest.startsAt),
    endsAt: formatForDateTimeLocal(contest.endsAt),
    settings: {
      visibility: contest.visibility,
      allowRegistration: contest.allowRegistration,
      showLeaderboard: contest.showLeaderboard,
    },
    problems: contest.problems.map((problem) => ({ ...problem })),
  }
}

function toProblemOption(problem: AdminProblem): ContestProblem {
  return {
    problemId: problem.id,
    problemCode: problem.code,
    problemTitle: problem.title,
    difficulty: problem.difficulty ?? null,
    maxScore: problem.score > 0 ? problem.score : 100,
  }
}

function ContestProblemPicker({
  existingProblems,
  open,
  onClose,
  onConfirm,
}: {
  existingProblems: ContestProblem[]
  open: boolean
  onClose: () => void
  onConfirm: (problems: ContestProblem[]) => void
}) {
  const { listProblems } = useContestAdmin()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(existingProblems.map((problem) => problem.problemId)),
  )
  const [problemOptions, setProblemOptions] = useState<ContestProblem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      listProblems(query).then((result) => {
        if (active) {
          setProblemOptions((current) => {
            const options = new Map(current.map((problem) => [problem.problemId, problem]))
            for (const problem of result.items.map(toProblemOption)) {
              options.set(problem.problemId, problem)
            }
            return [...options.values()]
          })
        }
      }).catch((cause: unknown) => {
        if (active) setError(contestErrorMessage(cause, 'Không thể tải danh sách bài tập.'))
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [listProblems, open, query])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  if (!open) return null

  const optionsById = new Map<string, ContestProblem>()
  for (const problem of existingProblems) optionsById.set(problem.problemId, problem)
  for (const problem of problemOptions) {
    if (!optionsById.has(problem.problemId)) optionsById.set(problem.problemId, problem)
  }
  const search = normalizeContestSearch(query.trim())
  const filteredOptions = [...optionsById.values()].filter((problem) => (
    normalizeContestSearch(`${problem.problemCode} ${problem.problemTitle}`).includes(search)
  ))

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = controls.item(0)
    const last = controls.item(controls.length - 1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function confirm() {
    onConfirm([...optionsById.values()].filter((problem) => selectedIds.has(problem.problemId)))
    onClose()
  }

  return (
    <div
      className={adminStyles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`${adminStyles.dialog} ${styles.pickerDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-picker-title"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.dialogHeading}>
          <div>
            <h2 id="problem-picker-title">Thêm bài tập vào cuộc thi</h2>
            <p>Chọn bài tập đã xuất bản từ danh sách trên hệ thống.</p>
          </div>
          <button
            className={adminStyles.iconButton}
            type="button"
            aria-label="Đóng danh sách bài tập"
            onClick={onClose}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
        <label className={`${adminStyles.searchField} ${styles.pickerSearch}`}>
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            aria-label="Tìm bài theo mã hoặc tên"
            placeholder="Tìm theo mã hoặc tên bài…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className={styles.pickerList} role="group" aria-label="Chọn bài tập" aria-busy={loading}>
          {error && <p className={adminStyles.formMessage} role="alert">{error}</p>}
          {loading && <p className={styles.emptyState} aria-live="polite">Đang tải bài tập…</p>}
          {!loading && filteredOptions.map((problem) => {
            const alreadyAdded = existingProblems.some((item) => item.problemId === problem.problemId)
            return (
              <label className={styles.pickerItem} key={problem.problemId}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(problem.problemId)}
                  disabled={alreadyAdded}
                  onChange={(event) => {
                    setSelectedIds((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(problem.problemId)
                      else next.delete(problem.problemId)
                      return next
                    })
                  }}
                />
                <span className={styles.pickerProblem}>
                  <strong>{problem.problemTitle}</strong>
                  <small>
                    {problem.problemCode} · {problem.maxScore} điểm
                    {alreadyAdded ? ' · Đã có trong cuộc thi' : ''}
                  </small>
                </span>
                {problem.difficulty && (
                  <span className={`${styles.difficulty} ${styles[`difficulty_${problem.difficulty}`]}`}>
                    {difficultyLabels[problem.difficulty]}
                  </span>
                )}
              </label>
            )
          })}
          {!loading && !error && filteredOptions.length === 0 && (
            <p className={styles.emptyState}>Không tìm thấy bài tập đã xuất bản phù hợp.</p>
          )}
        </div>
        <div className={adminStyles.dialogActions}>
          <span className={adminStyles.fieldHint}>Đã chọn {selectedIds.size} bài</span>
          <button className={adminStyles.buttonSecondary} type="button" onClick={onClose}>Hủy</button>
          <button className={adminStyles.buttonPrimary} type="button" onClick={confirm} disabled={Boolean(error)}>
            <Check size={15} aria-hidden="true" /> Xác nhận
          </button>
        </div>
      </section>
    </div>
  )
}

function AdminContestFormPage() {
  const { contestId } = useParams()
  const api = useContestAdmin()
  const [loadedContest, setLoadedContest] = useState<{ id: string; value: ContestDetail } | null>(null)
  const [loadFailure, setLoadFailure] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    if (!contestId) return
    let active = true
    api.get(contestId).then((result) => {
      if (active) setLoadedContest({ id: contestId, value: result })
    }).catch((cause: unknown) => {
      if (active) {
        setLoadFailure({
          id: contestId,
          message: contestErrorMessage(cause, 'Không thể tải thông tin cuộc thi.'),
        })
      }
    })
    return () => { active = false }
  }, [api, contestId])

  const contest = contestId && loadedContest?.id === contestId ? loadedContest.value : null
  const error = contestId && !contest && loadFailure?.id === contestId ? loadFailure.message : ''
  const loading = Boolean(contestId && !contest && !error)

  if (loading) {
    return <section className={adminStyles.panel} aria-live="polite">Đang tải thông tin cuộc thi…</section>
  }

  if (error || (contestId && !contest)) {
    return (
      <section className={adminStyles.panel}>
        <h1>{error.includes('Không tìm thấy') ? 'Không tìm thấy cuộc thi' : 'Không thể tải cuộc thi'}</h1>
        <p className={adminStyles.formMessage} role="alert">{error || 'Cuộc thi không tồn tại.'}</p>
        <Link className={adminStyles.buttonSecondary} to="/admin/contests">Quay lại danh sách</Link>
      </section>
    )
  }

  if (contest?.publicationStatus === 'ARCHIVED') {
    return <ArchivedContest contest={contest} />
  }

  return <ContestForm key={contest?.id ?? 'new-contest'} contest={contest ?? undefined} />
}

function ArchivedContest({ contest }: { contest: ContestDetail }) {
  const api = useContestAdmin()
  const { setNotice } = useAdmin()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function restore() {
    setLoading(true)
    setError('')
    try {
      await api.restore(contest.id)
      setNotice(`Đã khôi phục cuộc thi “${contest.title}”.`)
      navigate(`/admin/contests/${encodeURIComponent(contest.id)}/edit`, { replace: true })
    } catch (cause) {
      setError(contestErrorMessage(cause, 'Không thể khôi phục cuộc thi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={adminStyles.panel}>
      <h1>Cuộc thi đã lưu trữ</h1>
      <p className={adminStyles.pageSubtitle}>Khôi phục cuộc thi trước khi chỉnh sửa “{contest.title}”.</p>
      {error && <p className={adminStyles.formMessage} role="alert">{error}</p>}
      <div className={adminStyles.dialogActions}>
        <Link className={adminStyles.buttonSecondary} to="/admin/contests">Quay lại danh sách</Link>
        <button className={adminStyles.buttonPrimary} type="button" onClick={() => { void restore() }} disabled={loading}>
          {loading ? 'Đang khôi phục…' : 'Khôi phục và chỉnh sửa'}
        </button>
      </div>
    </section>
  )
}

function ContestForm({ contest }: { contest?: ContestDetail }) {
  const api = useContestAdmin()
  const navigate = useNavigate()
  const { setNotice } = useAdmin()
  const [initialValues] = useState(() => contest ? toFormValues(contest) : emptyFormValues())
  const [draft, setDraft] = useState<ContestFormValues>(initialValues)
  const [slugEdited, setSlugEdited] = useState(Boolean(contest))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const slugLocked = Boolean(contest?.publishedAt)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialValues)
  const totalPoints = draft.problems.reduce((total, problem) => total + Number(problem.maxScore || 0), 0)
  const problemsChanged = JSON.stringify(draft.problems.map(({ problemId, maxScore }) => ({ problemId, maxScore })))
    !== JSON.stringify(initialValues.problems.map(({ problemId, maxScore }) => ({ problemId, maxScore })))

  useEffect(() => {
    if (!dirty) return
    function preventAccidentalClose(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventAccidentalClose)
    return () => window.removeEventListener('beforeunload', preventAccidentalClose)
  }, [dirty])

  function update<K extends keyof ContestFormValues>(key: K, value: ContestFormValues[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
    setFormError('')
  }

  function updateSettings(key: keyof ContestFormValues['settings'], value: boolean | 'PUBLIC' | 'PRIVATE') {
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }))
    setFormError('')
  }

  function validate(publish: boolean): FormErrors {
    const next: FormErrors = {}
    const slug = draft.slug.trim()
    const title = draft.title.trim()

    if (!title) next.title = 'Vui lòng nhập tên cuộc thi.'
    else if (title.length > 255) next.title = 'Tên cuộc thi không được vượt quá 255 ký tự.'
    if (!slug) next.slug = 'Vui lòng nhập mã cuộc thi.'
    else if (slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      next.slug = 'Mã chỉ gồm tối đa 120 chữ thường, số và dấu gạch ngang.'
    }
    if (!draft.startsAt) next.startsAt = 'Vui lòng chọn thời gian bắt đầu.'
    if (!draft.endsAt) next.endsAt = 'Vui lòng chọn thời gian kết thúc.'

    const startsAt = draft.startsAt ? Date.parse(`${draft.startsAt}:00+07:00`) : Number.NaN
    const endsAt = draft.endsAt ? Date.parse(`${draft.endsAt}:00+07:00`) : Number.NaN
    if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt >= endsAt) {
      next.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
    }

    if (draft.description.length > 20_000) next.description = 'Mô tả không được vượt quá 20.000 ký tự.'
    if (draft.rules.length > 20_000) next.rules = 'Nội quy không được vượt quá 20.000 ký tự.'
    if (publish && draft.settings.visibility === 'PRIVATE') {
      next.visibility = 'Chưa thể xuất bản cuộc thi riêng tư vì V1 chưa có cơ chế cấp quyền truy cập.'
    }
    if (publish && draft.problems.length === 0) {
      next.problems = 'Thêm ít nhất một bài tập trước khi xuất bản.'
    }
    if (draft.problems.some((problem) => (
      !Number.isFinite(Number(problem.maxScore))
      || Number(problem.maxScore) < 0.01
      || Number(problem.maxScore) > 99_999_999.99
      || Math.abs(Number(problem.maxScore) * 100 - Math.round(Number(problem.maxScore) * 100)) > 1e-8
    ))) {
      next.problems = 'Điểm tối đa mỗi bài phải từ 0,01 đến 99.999.999,99 và không quá 2 chữ số thập phân.'
    }
    return next
  }

  async function save(publish: boolean) {
    if (saving) return
    const nextErrors = validate(publish)
    setErrors(nextErrors)
    setFormError('')
    if (Object.values(nextErrors).some(Boolean)) {
      const firstInvalid = Object.keys(nextErrors).find((key) => nextErrors[key])
      if (firstInvalid) document.getElementById(`contest-${firstInvalid}`)?.focus()
      setFormError(publish
        ? 'Vui lòng kiểm tra các trường bắt buộc và điều kiện xuất bản.'
        : 'Vui lòng kiểm tra thông tin cuộc thi.')
      return
    }

    let startsAt: string
    let endsAt: string
    try {
      startsAt = parseDateTimeLocal(draft.startsAt)
      endsAt = parseDateTimeLocal(draft.endsAt)
    } catch {
      setFormError('Không thể đọc ngày giờ. Vui lòng nhập lại thời gian tổ chức.')
      return
    }

    const input = {
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      rules: draft.rules.trim() || null,
      startsAt,
      endsAt,
      visibility: draft.settings.visibility,
      allowRegistration: draft.settings.allowRegistration,
      showLeaderboard: draft.settings.showLeaderboard,
    }
    const problemInputs = draft.problems.map((problem) => ({
      problemId: problem.problemId,
      maxScore: Number(problem.maxScore),
    }))

    setSaving(true)
    let createdId: string | null = null
    let basicDataSaved = false
    try {
      const saved = contest
        ? await api.update(contest.id, input)
        : await api.create(input)
      if (!contest) createdId = saved.id
      basicDataSaved = true

      if ((!contest && problemInputs.length > 0) || (contest && problemsChanged)) {
        await api.replaceProblems(saved.id, problemInputs)
      }

      let finalContest = saved
      if (publish && saved.publicationStatus === 'DRAFT') {
        finalContest = await api.publish(saved.id)
      }

      setNotice(publish
        ? `Đã lưu và xuất bản cuộc thi “${finalContest.title}”.`
        : `Đã lưu cuộc thi “${finalContest.title}” trên hệ thống.`)
      navigate('/admin/contests')
    } catch (cause) {
      const reason = contestErrorMessage(cause, 'Không thể lưu cuộc thi.')
      if (createdId) {
        setNotice(`Đã tạo bản nháp, nhưng chưa hoàn tất lưu bài tập hoặc xuất bản: ${reason}`)
        navigate(`/admin/contests/${encodeURIComponent(createdId)}/edit`)
      } else if (basicDataSaved) {
        setFormError(publish
          ? `Thông tin đã được lưu, nhưng không thể hoàn tất cập nhật bài tập hoặc xuất bản: ${reason}`
          : `Thông tin cơ bản đã được lưu, nhưng danh sách bài tập chưa được cập nhật: ${reason}`)
      } else {
        setFormError(reason)
      }
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(contest?.publicationStatus !== 'PUBLISHED')
  }

  function cancel() {
    if (dirty) setConfirmLeave(true)
    else navigate('/admin/contests')
  }

  function addProblems(selected: ContestProblem[]) {
    setDraft((current) => {
      const existingIds = new Set(current.problems.map((problem) => problem.problemId))
      const additional = selected.filter((problem) => !existingIds.has(problem.problemId))
      return { ...current, problems: [...current.problems, ...additional] }
    })
    setErrors((current) => ({ ...current, problems: '' }))
  }

  function moveProblem(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const next = [...current.problems]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...current, problems: next }
    })
  }

  function removeProblem(problemId: string) {
    setDraft((current) => ({
      ...current,
      problems: current.problems.filter((problem) => problem.problemId !== problemId),
    }))
    setErrors((current) => ({ ...current, problems: '' }))
  }

  return (
    <>
      <div className={adminStyles.pageHeading}>
        <div>
          <p className={adminStyles.eyebrow}>QUẢN LÝ NỘI DUNG</p>
          <h1>{contest ? 'Chỉnh sửa cuộc thi' : 'Tạo cuộc thi mới'}</h1>
          <p className={adminStyles.pageSubtitle}>
            {contest ? `Đang chỉnh sửa ${contest.slug}.` : 'Thiết lập thông tin và bài tập cho cuộc thi.'}
          </p>
        </div>
        <button className={adminStyles.buttonSecondary} type="button" onClick={cancel}>← Danh sách cuộc thi</button>
      </div>

      <div className={`${adminStyles.demoNotice} ${styles.formNotice}`} role="note">
        <Info size={17} aria-hidden="true" />
        <span>Thay đổi được lưu trên Backend. Cuộc thi dùng chung khung giờ tổ chức; thời lượng làm bài riêng chưa được hỗ trợ.</span>
      </div>

      {formError && <p className={adminStyles.formMessage} role="alert">{formError}</p>}

      <form onSubmit={submit} noValidate>
        <section id="contest-problems" className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Thông tin cơ bản</h2>
          <p className={adminStyles.sectionHint}>Tên, mã nhận diện và nội dung giới thiệu cuộc thi.</p>
          <div className={adminStyles.formGrid}>
            <div className={adminStyles.field}>
              <label htmlFor="contest-title">Tên cuộc thi <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-title"
                required
                maxLength={255}
                value={draft.title}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'contest-title-error' : undefined}
                onChange={(event) => {
                  const title = event.target.value
                  setDraft((current) => ({
                    ...current,
                    title,
                    ...(!slugEdited && !slugLocked ? { slug: suggestContestCode(title) } : {}),
                  }))
                  setErrors((current) => ({ ...current, title: '', slug: '' }))
                  setFormError('')
                }}
              />
              {errors.title && <p id="contest-title-error" className={styles.inlineError} role="alert">{errors.title}</p>}
            </div>
            <div className={adminStyles.field}>
              <label htmlFor="contest-slug">Mã cuộc thi / slug <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-slug"
                required
                maxLength={120}
                value={draft.slug}
                disabled={slugLocked}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={errors.slug ? 'contest-slug-error' : 'contest-slug-hint'}
                onChange={(event) => {
                  setSlugEdited(true)
                  update('slug', event.target.value)
                }}
              />
              {errors.slug
                ? <p id="contest-slug-error" className={styles.inlineError} role="alert">{errors.slug}</p>
                : <p id="contest-slug-hint" className={adminStyles.fieldHint}>
                  {slugLocked ? 'Slug không thể thay đổi sau khi xuất bản.' : 'Tự đề xuất từ tên; dùng chữ thường, số và dấu gạch ngang.'}
                </p>}
            </div>
            <div className={`${adminStyles.field} ${styles.fieldFull}`}>
              <label htmlFor="contest-description">Mô tả cuộc thi</label>
              <textarea
                id="contest-description"
                rows={4}
                maxLength={20_000}
                value={draft.description}
                onChange={(event) => update('description', event.target.value)}
              />
              {errors.description && <p className={styles.inlineError} role="alert">{errors.description}</p>}
            </div>
            <div className={`${adminStyles.field} ${styles.fieldFull}`}>
              <label htmlFor="contest-rules">Nội quy hoặc hướng dẫn tham gia</label>
              <textarea
                id="contest-rules"
                rows={4}
                maxLength={20_000}
                value={draft.rules}
                onChange={(event) => update('rules', event.target.value)}
              />
              {errors.rules && <p className={styles.inlineError} role="alert">{errors.rules}</p>}
            </div>
          </div>
        </section>

        <section className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Thời gian tổ chức</h2>
          <p className={adminStyles.sectionHint}>Thời gian hiển thị và quy đổi theo múi giờ Việt Nam (UTC+07:00).</p>
          <div className={adminStyles.formGrid}>
            <div className={adminStyles.field}>
              <label htmlFor="contest-startsAt">Thời gian bắt đầu <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-startsAt"
                type="datetime-local"
                required
                value={draft.startsAt}
                aria-invalid={Boolean(errors.startsAt)}
                aria-describedby={errors.startsAt ? 'contest-startsAt-error' : undefined}
                onChange={(event) => update('startsAt', event.target.value)}
              />
              {errors.startsAt && <p id="contest-startsAt-error" className={styles.inlineError} role="alert">{errors.startsAt}</p>}
            </div>
            <div className={adminStyles.field}>
              <label htmlFor="contest-endsAt">Thời gian kết thúc <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-endsAt"
                type="datetime-local"
                required
                value={draft.endsAt}
                aria-invalid={Boolean(errors.endsAt)}
                aria-describedby={errors.endsAt ? 'contest-endsAt-error' : undefined}
                onChange={(event) => update('endsAt', event.target.value)}
              />
              {errors.endsAt && <p id="contest-endsAt-error" className={styles.inlineError} role="alert">{errors.endsAt}</p>}
            </div>
            <p className={`${adminStyles.fieldHint} ${styles.fieldFull}`}>
              Tất cả thí sinh sử dụng cùng khung giờ từ lúc bắt đầu đến lúc kết thúc.
            </p>
          </div>
        </section>

        <section className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Cấu hình cuộc thi</h2>
          <p className={adminStyles.sectionHint}>Cấu hình được lưu trực tiếp cùng cuộc thi trên hệ thống.</p>
          <div className={styles.settingsGroup}>
            <fieldset className={adminStyles.field}>
              <legend>Chế độ hiển thị</legend>
              <div className={styles.settingsChoices}>
                <label className={styles.settingsChoice}>
                  <input
                    type="radio"
                    name="contest-visibility"
                    checked={draft.settings.visibility === 'PUBLIC'}
                    onChange={() => updateSettings('visibility', 'PUBLIC')}
                  />
                  Công khai
                </label>
                <label className={styles.settingsChoice}>
                  <input
                    type="radio"
                    name="contest-visibility"
                    checked={draft.settings.visibility === 'PRIVATE'}
                    onChange={() => updateSettings('visibility', 'PRIVATE')}
                  />
                  Riêng tư
                </label>
              </div>
              {errors.visibility && <p className={styles.inlineError} role="alert">{errors.visibility}</p>}
              {draft.settings.visibility === 'PRIVATE' && (
                <p className={adminStyles.fieldHint}>Cuộc thi riêng tư có thể lưu nháp nhưng chưa thể xuất bản trong V1.</p>
              )}
            </fieldset>
            <div className={styles.settingsChoices}>
              <label className={styles.settingsChoice}>
                <input
                  type="checkbox"
                  checked={draft.settings.allowRegistration}
                  onChange={(event) => updateSettings('allowRegistration', event.target.checked)}
                />
                Cho phép đăng ký tham gia
              </label>
              <label className={styles.settingsChoice}>
                <input
                  type="checkbox"
                  checked={draft.settings.showLeaderboard}
                  onChange={(event) => updateSettings('showLeaderboard', event.target.checked)}
                />
                Hiển thị bảng xếp hạng
              </label>
            </div>
            <div className={styles.rankingRule}>
              <Trophy size={18} aria-hidden="true" />
              <span><strong>Cách xếp hạng</strong>Tổng điểm giảm dần, sau đó thời gian tăng dần.</span>
            </div>
          </div>
        </section>

        <section className={`${adminStyles.panel} ${styles.formSection}`}>
          <div className={styles.problemListHeading}>
            <div>
              <h2>Bài tập trong cuộc thi</h2>
              <p className={adminStyles.sectionHint}>Chọn bài đã xuất bản; thứ tự được dùng làm thứ tự hiển thị.</p>
            </div>
            <button className={adminStyles.buttonSecondary} type="button" onClick={() => setPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Thêm bài tập
            </button>
          </div>
          <div className={styles.problemTotals}>
            <span><strong>{draft.problems.length}</strong> bài tập</span>
            <span>Tổng điểm tối đa: <strong>{totalPoints.toLocaleString('vi-VN')}</strong></span>
          </div>
          {errors.problems && <p id="contest-problems-error" className={styles.inlineError} role="alert">{errors.problems}</p>}
          {draft.problems.length === 0 ? (
            <div className={styles.emptyState}>
              <BookOpen size={22} aria-hidden="true" />
              <strong>Chưa có bài tập</strong>
              <p>Thêm ít nhất một bài để tạo nội dung cuộc thi.</p>
            </div>
          ) : (
            <div className={`${adminStyles.tableWrap} ${styles.problemTableWrap}`}>
              <table className={styles.problemTable}>
                <thead>
                  <tr>
                    <th scope="col">STT</th>
                    <th scope="col">MÃ BÀI</th>
                    <th scope="col">TÊN BÀI</th>
                    <th scope="col">ĐỘ KHÓ</th>
                    <th scope="col">ĐIỂM TỐI ĐA</th>
                    <th scope="col">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.problems.map((problem, index) => (
                    <tr key={problem.problemId}>
                      <td data-label="STT">{index + 1}</td>
                      <td data-label="Mã bài"><span className={adminStyles.code}>{problem.problemCode}</span></td>
                      <td data-label="Tên bài">{problem.problemTitle}</td>
                      <td data-label="Độ khó">
                        {problem.difficulty
                          ? <span className={`${styles.difficulty} ${styles[`difficulty_${problem.difficulty}`]}`}>{difficultyLabels[problem.difficulty]}</span>
                          : '—'}
                      </td>
                      <td data-label="Điểm tối đa">
                        <input
                          aria-label={`Điểm tối đa của ${problem.problemCode}`}
                          type="number"
                          min="0.01"
                          max="99999999.99"
                          step="0.01"
                          value={problem.maxScore}
                          onChange={(event) => {
                            const maxScore = event.target.value === '' ? 0 : Number(event.target.value)
                            setDraft((current) => ({
                              ...current,
                              problems: current.problems.map((item) => (
                                item.problemId === problem.problemId ? { ...item, maxScore } : item
                              )),
                            }))
                            setErrors((current) => ({ ...current, problems: '' }))
                          }}
                        />
                      </td>
                      <td data-label="Thao tác">
                        <div className={styles.problemOrder}>
                          <button
                            className={styles.orderButton}
                            type="button"
                            aria-label={`Đưa ${problem.problemCode} lên`}
                            disabled={index === 0}
                            onClick={() => moveProblem(index, -1)}
                          >
                            <ArrowUp size={15} aria-hidden="true" />
                          </button>
                          <button
                            className={styles.orderButton}
                            type="button"
                            aria-label={`Đưa ${problem.problemCode} xuống`}
                            disabled={index === draft.problems.length - 1}
                            onClick={() => moveProblem(index, 1)}
                          >
                            <ArrowDown size={15} aria-hidden="true" />
                          </button>
                          <button
                            className={`${styles.orderButton} ${adminStyles.iconButtonDanger}`}
                            type="button"
                            aria-label={`Xóa ${problem.problemCode} khỏi cuộc thi`}
                            onClick={() => removeProblem(problem.problemId)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className={styles.formActions}>
          <button className={adminStyles.buttonQuiet} type="button" onClick={cancel} disabled={saving}>Hủy</button>
          {(contest?.publicationStatus !== 'PUBLISHED') && (
            <button className={adminStyles.buttonSecondary} type="button" onClick={() => { void save(false) }} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu bản nháp'}
            </button>
          )}
          <button className={adminStyles.buttonPrimary} type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : contest?.publicationStatus === 'PUBLISHED' ? 'Lưu thay đổi' : 'Xuất bản'}
          </button>
        </div>
      </form>

      <ContestProblemPicker
        key={`${contest?.id ?? 'new'}-${pickerOpen ? 'open' : 'closed'}`}
        existingProblems={draft.problems}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={addProblems}
      />
      {confirmLeave && (
        <ConfirmDialog
          title="Hủy thay đổi?"
          description="Các thay đổi chưa lưu sẽ bị mất nếu quay lại danh sách."
          confirmLabel="Rời trang"
          danger
          onConfirm={() => navigate('/admin/contests')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  )
}

export default AdminContestFormPage
