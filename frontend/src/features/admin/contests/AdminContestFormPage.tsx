import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Check, Info, Plus, Search, Trash2, Trophy } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sampleProblems } from '../../problems/data'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AdminIcon } from '../components/AdminIcons'
import { useAdmin } from '../useAdmin'
import { useContestAdmin } from './useContestAdmin'
import {
  formatForDateTimeLocal,
  normalizeContestSearch,
  parseDateTimeLocal,
  suggestContestCode,
} from './contest-utils'
import type {
  Contest,
  ContestFormValues,
  ContestProblem,
  ContestPublicationStatus,
} from './types'
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
    code: '',
    title: '',
    description: '',
    rules: '',
    startTime: '',
    endTime: '',
    durationMinutes: 90,
    settings: {
      visibility: 'public',
      allowRegistration: true,
      showLeaderboard: true,
    },
    problems: [],
  }
}

function toFormValues(contest: Contest): ContestFormValues {
  return {
    id: contest.id,
    code: contest.code,
    title: contest.title,
    description: contest.description,
    rules: contest.rules,
    startTime: formatForDateTimeLocal(contest.startTime),
    endTime: formatForDateTimeLocal(contest.endTime),
    durationMinutes: contest.durationMinutes,
    settings: { ...contest.settings },
    problems: contest.problems.map((problem) => ({ ...problem })),
    ...(contest.studentPageId ? { studentPageId: contest.studentPageId } : {}),
  }
}

function toProblemOption(problem: typeof sampleProblems[number]): ContestProblem {
  return {
    problemId: problem.id,
    code: problem.code,
    title: problem.title,
    difficulty: problem.points <= 100 ? 'easy' : problem.points <= 200 ? 'medium' : 'hard',
    maxScore: problem.points,
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
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(existingProblems.map((problem) => problem.problemId)),
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const options = useMemo(() => {
    const mapped = sampleProblems.map(toProblemOption)
    const existingIds = new Set(existingProblems.map((problem) => problem.problemId))
    return [...existingProblems, ...mapped.filter((problem) => !existingIds.has(problem.problemId))]
  }, [existingProblems])
  const search = normalizeContestSearch(query.trim())
  const filteredOptions = options.filter((problem) => (
    normalizeContestSearch(`${problem.code} ${problem.title}`).includes(search)
  ))

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  if (!open) return null

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
    onConfirm(options.filter((problem) => selectedIds.has(problem.problemId)))
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
            <p>Chọn một hoặc nhiều bài tập từ danh sách mẫu.</p>
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
        <div className={styles.pickerList} role="group" aria-label="Chọn bài tập">
          {filteredOptions.map((problem) => {
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
                  <strong>{problem.title}</strong>
                  <small>{problem.code} · {problem.maxScore} điểm{alreadyAdded ? ' · Đã có trong cuộc thi' : ''}</small>
                </span>
                <span className={`${styles.difficulty} ${styles[`difficulty_${problem.difficulty}`]}`}>
                  {difficultyLabels[problem.difficulty]}
                </span>
              </label>
            )
          })}
          {filteredOptions.length === 0 && (
            <p className={styles.emptyState}>Không tìm thấy bài tập phù hợp.</p>
          )}
        </div>
        <div className={adminStyles.dialogActions}>
          <span className={adminStyles.fieldHint}>Đã chọn {selectedIds.size} bài</span>
          <button className={adminStyles.buttonSecondary} type="button" onClick={onClose}>Hủy</button>
          <button className={adminStyles.buttonPrimary} type="button" onClick={confirm}>
            <Check size={15} aria-hidden="true" /> Xác nhận
          </button>
        </div>
      </section>
    </div>
  )
}

function AdminContestFormPage() {
  const { contestId } = useParams()
  const { getContest } = useContestAdmin()
  const contest = contestId ? getContest(contestId) : undefined

  if (contestId && !contest) {
    return (
      <section className={adminStyles.panel}>
        <h1>Không tìm thấy cuộc thi</h1>
        <p className={adminStyles.pageSubtitle}>Cuộc thi không tồn tại trong dữ liệu mock của phiên này.</p>
        <Link className={adminStyles.buttonSecondary} to="/admin/contests">Quay lại danh sách</Link>
      </section>
    )
  }

  return <ContestForm key={contest?.id ?? 'new-contest'} contest={contest} />
}

function ContestForm({ contest }: { contest?: Contest }) {
  const navigate = useNavigate()
  const { contests, saveContest } = useContestAdmin()
  const { setNotice } = useAdmin()
  const [initialValues] = useState(() => contest ? toFormValues(contest) : emptyFormValues())
  const [draft, setDraft] = useState<ContestFormValues>(initialValues)
  const [codeEdited, setCodeEdited] = useState(Boolean(contest))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialValues)
  const totalPoints = draft.problems.reduce((total, problem) => total + problem.maxScore, 0)

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

  function updateSettings(key: keyof ContestFormValues['settings'], value: boolean | 'public' | 'private') {
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }))
  }

  function validate(status: ContestPublicationStatus): FormErrors {
    const next: FormErrors = {}
    const code = draft.code.trim()
    const title = draft.title.trim()

    if (!title) next.title = 'Vui lòng nhập tên cuộc thi.'
    if (!code) next.code = 'Vui lòng nhập mã cuộc thi.'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
      next.code = 'Mã chỉ gồm chữ thường, số và dấu gạch ngang.'
    } else if (contests.some((item) => item.code.toLocaleLowerCase() === code.toLocaleLowerCase() && item.id !== contest?.id)) {
      next.code = 'Mã cuộc thi đã được sử dụng.'
    }

    if (status === 'published') {
      if (!draft.startTime) next.startTime = 'Vui lòng chọn thời gian bắt đầu.'
      if (!draft.endTime) next.endTime = 'Vui lòng chọn thời gian kết thúc.'

      const start = draft.startTime ? Date.parse(`${draft.startTime}:00+07:00`) : Number.NaN
      const end = draft.endTime ? Date.parse(`${draft.endTime}:00+07:00`) : Number.NaN
      if (Number.isFinite(start) && Number.isFinite(end) && start >= end) {
        next.endTime = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
      }

      if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes <= 0) {
        next.durationMinutes = 'Thời gian làm bài phải là số phút lớn hơn 0.'
      }
      if (draft.problems.length === 0) {
        next.problems = 'Thêm ít nhất một bài tập trước khi xuất bản.'
      }
    }

    return next
  }

  function save(status: ContestPublicationStatus) {
    const nextErrors = validate(status)
    setErrors(nextErrors)
    setFormError('')
    if (Object.values(nextErrors).some(Boolean)) {
      const firstInvalid = Object.keys(nextErrors).find((key) => nextErrors[key])
      if (firstInvalid) {
        const element = document.getElementById(`contest-${firstInvalid}`)
        element?.focus()
      }
      setFormError(status === 'published'
        ? 'Vui lòng kiểm tra các trường bắt buộc và điều kiện xuất bản.'
        : 'Vui lòng nhập tên và mã cuộc thi hợp lệ.')
      return
    }

    let startTime = ''
    let endTime = ''
    try {
      if (draft.startTime) startTime = parseDateTimeLocal(draft.startTime)
      if (draft.endTime) endTime = parseDateTimeLocal(draft.endTime)
    } catch {
      setFormError('Không thể đọc ngày giờ. Vui lòng nhập lại thời gian tổ chức.')
      return
    }

    const values: ContestFormValues = {
      ...draft,
      id: contest?.id,
      code: draft.code.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      rules: draft.rules.trim(),
      startTime,
      endTime,
      problems: draft.problems.map((problem) => ({ ...problem })),
    }
    const saved = saveContest(values, status)
    setNotice(status === 'published'
      ? `Đã xuất bản “${saved.title}” trong mock state của phiên này.`
      : `Đã lưu bản nháp “${saved.title}” trong mock state của phiên này.`)
    navigate('/admin/contests')
  }

  function submitPublished(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save('published')
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
            {contest ? `Đang chỉnh sửa ${contest.code}.` : 'Thiết lập thông tin và bài tập cho cuộc thi.'}
          </p>
        </div>
        <button className={adminStyles.buttonSecondary} type="button" onClick={cancel}>← Danh sách cuộc thi</button>
      </div>

      <div className={`${adminStyles.demoNotice} ${styles.formNotice}`} role="note">
        <Info size={17} aria-hidden="true" />
        <span>Thay đổi chỉ tồn tại trong state của phiên Admin hiện tại; tải lại trang sẽ khôi phục dữ liệu mẫu ban đầu. Chưa kết nối Backend/API.</span>
      </div>

      {formError && <p className={adminStyles.formMessage} role="alert">{formError}</p>}

      <form onSubmit={submitPublished} noValidate>
        <section id="contest-problems" className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Thông tin cơ bản</h2>
          <p className={adminStyles.sectionHint}>Tên, mã nhận diện và nội dung giới thiệu cuộc thi.</p>
          <div className={adminStyles.formGrid}>
            <div className={adminStyles.field}>
              <label htmlFor="contest-title">Tên cuộc thi <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-title"
                required
                maxLength={140}
                value={draft.title}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'contest-title-error' : undefined}
                onChange={(event) => {
                  const title = event.target.value
                  setDraft((current) => ({
                    ...current,
                    title,
                    ...(!codeEdited ? { code: suggestContestCode(title) } : {}),
                  }))
                  setErrors((current) => ({ ...current, title: '', code: '' }))
                  setFormError('')
                }}
              />
              {errors.title && <p id="contest-title-error" className={styles.inlineError} role="alert">{errors.title}</p>}
            </div>
            <div className={adminStyles.field}>
              <label htmlFor="contest-code">Mã cuộc thi / slug <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-code"
                required
                maxLength={100}
                value={draft.code}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? 'contest-code-error' : 'contest-code-hint'}
                onChange={(event) => {
                  setCodeEdited(true)
                  update('code', event.target.value)
                }}
              />
              {errors.code
                ? <p id="contest-code-error" className={styles.inlineError} role="alert">{errors.code}</p>
                : <p id="contest-code-hint" className={adminStyles.fieldHint}>Tự đề xuất từ tên; dùng chữ thường, số và dấu gạch ngang.</p>}
            </div>
            <div className={`${adminStyles.field} ${styles.fieldFull}`}>
              <label htmlFor="contest-description">Mô tả cuộc thi</label>
              <textarea
                id="contest-description"
                rows={4}
                maxLength={2000}
                value={draft.description}
                onChange={(event) => update('description', event.target.value)}
              />
            </div>
            <div className={`${adminStyles.field} ${styles.fieldFull}`}>
              <label htmlFor="contest-rules">Nội quy hoặc hướng dẫn tham gia</label>
              <textarea
                id="contest-rules"
                rows={4}
                maxLength={5000}
                value={draft.rules}
                onChange={(event) => update('rules', event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Thời gian tổ chức</h2>
          <p className={adminStyles.sectionHint}>Thời gian hiển thị và quy đổi theo múi giờ Việt Nam (UTC+07:00).</p>
          <div className={adminStyles.formGrid}>
            <div className={adminStyles.field}>
              <label htmlFor="contest-startTime">Thời gian bắt đầu <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-startTime"
                type="datetime-local"
                required
                value={draft.startTime}
                aria-invalid={Boolean(errors.startTime)}
                aria-describedby={errors.startTime ? 'contest-startTime-error' : undefined}
                onChange={(event) => update('startTime', event.target.value)}
              />
              {errors.startTime && <p id="contest-startTime-error" className={styles.inlineError} role="alert">{errors.startTime}</p>}
            </div>
            <div className={adminStyles.field}>
              <label htmlFor="contest-endTime">Thời gian kết thúc <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-endTime"
                type="datetime-local"
                required
                value={draft.endTime}
                aria-invalid={Boolean(errors.endTime)}
                aria-describedby={errors.endTime ? 'contest-endTime-error' : undefined}
                onChange={(event) => update('endTime', event.target.value)}
              />
              {errors.endTime && <p id="contest-endTime-error" className={styles.inlineError} role="alert">{errors.endTime}</p>}
            </div>
            <div className={adminStyles.field}>
              <label htmlFor="contest-durationMinutes">Thời gian làm bài (phút) <span className={adminStyles.requiredMark}>*</span></label>
              <input
                id="contest-durationMinutes"
                type="number"
                required
                min="1"
                step="1"
                value={draft.durationMinutes}
                aria-invalid={Boolean(errors.durationMinutes)}
                aria-describedby={errors.durationMinutes ? 'contest-durationMinutes-error' : undefined}
                onChange={(event) => update('durationMinutes', Number(event.target.value))}
              />
              {errors.durationMinutes && <p id="contest-durationMinutes-error" className={styles.inlineError} role="alert">{errors.durationMinutes}</p>}
              <p className={adminStyles.fieldHint}>Thời gian làm bài được cấu hình riêng, không mặc định bằng toàn bộ thời lượng sự kiện.</p>
            </div>
          </div>
        </section>

        <section className={`${adminStyles.panel} ${styles.formSection}`}>
          <h2>Cấu hình cuộc thi</h2>
          <p className={adminStyles.sectionHint}>Các tùy chọn dưới đây chỉ lưu trong mock state giao diện.</p>
          <div className={styles.settingsGroup}>
            <fieldset className={adminStyles.field}>
              <legend>Chế độ hiển thị</legend>
              <div className={styles.settingsChoices}>
                <label className={styles.settingsChoice}>
                  <input
                    type="radio"
                    name="contest-visibility"
                    checked={draft.settings.visibility === 'public'}
                    onChange={() => updateSettings('visibility', 'public')}
                  />
                  Công khai
                </label>
                <label className={styles.settingsChoice}>
                  <input
                    type="radio"
                    name="contest-visibility"
                    checked={draft.settings.visibility === 'private'}
                    onChange={() => updateSettings('visibility', 'private')}
                  />
                  Riêng tư
                </label>
              </div>
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
              <p className={adminStyles.sectionHint}>Chọn bài từ dữ liệu frontend hiện có; thứ tự được dùng làm thứ tự hiển thị.</p>
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
                      <td data-label="Mã bài"><span className={adminStyles.code}>{problem.code}</span></td>
                      <td data-label="Tên bài">{problem.title}</td>
                      <td data-label="Độ khó"><span className={`${styles.difficulty} ${styles[`difficulty_${problem.difficulty}`]}`}>{difficultyLabels[problem.difficulty]}</span></td>
                      <td data-label="Điểm tối đa">{problem.maxScore.toLocaleString('vi-VN')}</td>
                      <td data-label="Thao tác">
                        <div className={styles.problemOrder}>
                          <button
                            className={styles.orderButton}
                            type="button"
                            aria-label={`Đưa ${problem.code} lên`}
                            disabled={index === 0}
                            onClick={() => moveProblem(index, -1)}
                          >
                            <ArrowUp size={15} aria-hidden="true" />
                          </button>
                          <button
                            className={styles.orderButton}
                            type="button"
                            aria-label={`Đưa ${problem.code} xuống`}
                            disabled={index === draft.problems.length - 1}
                            onClick={() => moveProblem(index, 1)}
                          >
                            <ArrowDown size={15} aria-hidden="true" />
                          </button>
                          <button
                            className={`${styles.orderButton} ${adminStyles.iconButtonDanger}`}
                            type="button"
                            aria-label={`Xóa ${problem.code} khỏi cuộc thi`}
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
          <button className={adminStyles.buttonQuiet} type="button" onClick={cancel}>Hủy</button>
          <button className={adminStyles.buttonSecondary} type="button" onClick={() => save('draft')}>Lưu bản nháp</button>
          <button className={adminStyles.buttonPrimary} type="submit">Xuất bản</button>
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
