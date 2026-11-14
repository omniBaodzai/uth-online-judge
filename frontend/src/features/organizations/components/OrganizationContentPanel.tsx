import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  archiveOrganizationContest,
  createOrganizationContest,
  createOrganizationProblem,
  createOrganizationProblemGrant,
  deleteOrganizationProblem,
  errorMessage,
  getOrganizationContest,
  getOrganizationContestProblem,
  getOrganizationProblem,
  getOrganizationProblemTestCases,
  listOrganizationContests,
  listOrganizationContestProblemOptions,
  listOrganizationProblemGrants,
  listOrganizationProblems,
  listOrganizations,
  publishOrganizationContest,
  replaceOrganizationContestProblems,
  restoreOrganizationContest,
  revokeOrganizationProblemGrant,
  setOrganizationProblemStatus,
  updateOrganizationContest,
  updateOrganizationProblem,
  type OrganizationContest,
  type OrganizationContestProblemOption,
  type OrganizationProblem,
  type OrganizationProblemGrant,
  type OrganizationProblemInput,
  type OrganizationTestCases,
} from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import styles from './OrganizationContentPanel.module.css'

type Props = {
  slug: string
  section: 'problems' | 'contests'
  canManage: boolean
  archived: boolean
  showGuidance?: boolean
  showEmptyStateText?: boolean
  adminDetail?: boolean
}

type ProblemForm = {
  code: string
  title: string
  summary: string
  statement: string
  difficulty: OrganizationProblem['difficulty']
  tags: string
  languages: string
  inputDescription: string
  outputDescription: string
  constraints: string
  timeLimitSeconds: string
  memoryLimitMb: string
}

type TestCaseForm = {
  id?: string
  name: string
  input: string
  expectedOutput: string
  kind: 'sample' | 'hidden'
}

type EditorialForm = {
  id?: string
  title: string
  language: string
  sourceCode: string
}

const EMPTY_PROBLEM: ProblemForm = {
  code: '',
  title: '',
  summary: '',
  statement: '',
  difficulty: 'easy',
  tags: '',
  languages: '',
  inputDescription: '',
  outputDescription: '',
  constraints: '',
  timeLimitSeconds: '2',
  memoryLimitMb: '256',
}

type ContestForm = {
  slug: string
  title: string
  description: string
  rules: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
}

const EMPTY_CONTEST: ContestForm = {
  slug: '',
  title: '',
  description: '',
  rules: '',
  startsAt: '',
  endsAt: '',
  visibility: 'PUBLIC',
}

function commaValues(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function toLocalDateTime(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString()
}

function ProblemPanel({
  slug,
  canManage,
  archived,
  showGuidance = true,
  showEmptyStateText = true,
  adminDetail = false,
}: Omit<Props, 'section'>) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<OrganizationProblem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<OrganizationProblem | null>(null)
  const [form, setForm] = useState(EMPTY_PROBLEM)
  const [testCases, setTestCases] = useState<OrganizationTestCases | null>(null)
  const [caseRows, setCaseRows] = useState<TestCaseForm[]>([])
  const [editorialRows, setEditorialRows] = useState<EditorialForm[]>([])
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showGrants, setShowGrants] = useState(false)
  const [grants, setGrants] = useState<OrganizationProblemGrant[]>([])
  const [organizations, setOrganizations] = useState<Array<{ id: string; slug: string; name: string }>>([])
  const [grantScope, setGrantScope] = useState<'ORGANIZATION' | 'GLOBAL_CONTESTS'>('ORGANIZATION')
  const [granteeId, setGranteeId] = useState('')
  const pageSize = 10

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    listOrganizationProblems(api, slug, { page, pageSize, search: query }, controller.signal)
      .then((result) => {
        setItems(result.items)
        setTotal(result.total)
        setError('')
        if (selectedId && !result.items.some((item) => item.id === selectedId)) {
          setSelectedId('')
          setSelected(null)
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, t('organizationContentLoadError')))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, page, pageSize, query, reloadKey, selectedId, slug, t])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    getOrganizationProblem(api, slug, selectedId, controller.signal)
      .then((problem) => {
        setSelected(problem)
        setEditorialRows(problem.editorials.map(({ id, title, language, sourceCode }) => ({
          id,
          title,
          language,
          sourceCode,
        })))
        setForm({
          code: problem.code,
          title: problem.title,
          summary: problem.summary ?? '',
          statement: problem.statement,
          difficulty: problem.difficulty,
          tags: problem.tags.join(', '),
          languages: problem.languages.join(', '),
          inputDescription: problem.inputDescription,
          outputDescription: problem.outputDescription,
          constraints: problem.constraints,
          timeLimitSeconds: String(problem.timeLimitSeconds),
          memoryLimitMb: String(problem.memoryLimitMb),
        })
        if (canManage) {
          void getOrganizationProblemTestCases(api, slug, selectedId)
            .then((result) => {
              setTestCases(result)
              setCaseRows(result.cases.map(({ id, name, input, expectedOutput, kind }) => ({
                id,
                name,
                input,
                expectedOutput,
                kind,
              })))
            })
            .catch((caught: unknown) => setError(errorMessage(caught, t('organizationContentLoadError'))))
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, t('organizationContentLoadError')))
      })
    return () => controller.abort()
  }, [api, canManage, selectedId, slug, t])

  async function loadGrants(problemId: string) {
    setError('')
    try {
      const [grantRows, organizationPage] = await Promise.all([
        listOrganizationProblemGrants(api, slug, problemId),
        listOrganizations(api, { page: 1, pageSize: 100, sort: 'name' }),
      ])
      setGrants(grantRows)
      setOrganizations(organizationPage.items.filter((item) => item.slug !== slug))
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentLoadError')))
    }
  }

  function startCreate() {
    setSelectedId('')
    setSelected(null)
    setTestCases(null)
    setForm(EMPTY_PROBLEM)
    setCaseRows([])
    setTestCases(null)
    setEditorialRows([])
    setCreating(true)
    setEditing(false)
    setShowGrants(false)
    setError('')
    setNotice('')
  }

  async function saveProblem(event: FormEvent) {
    event.preventDefault()
    if (busy || !canManage || archived) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!creating && canManage && !testCases) throw new Error(t('organizationContentLoading'))
      const currentCases = testCases?.cases.map(({ id, name, input, expectedOutput, kind }) => ({
        id,
        name,
        input,
        expectedOutput,
        kind,
      }))
      const testCasesChanged = creating || (
        currentCases !== undefined
        && JSON.stringify(caseRows) !== JSON.stringify(currentCases)
      )
      const currentEditorials = selected?.editorials.map(({ id, title, language, sourceCode }) => ({
        id,
        title,
        language,
        sourceCode,
      }))
      const editorialsChanged = creating || (
        currentEditorials !== undefined
        && JSON.stringify(editorialRows) !== JSON.stringify(currentEditorials)
      )
      const input: OrganizationProblemInput = {
        code: form.code.trim(),
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        statement: form.statement,
        difficulty: form.difficulty,
        tags: commaValues(form.tags),
        languages: commaValues(form.languages),
        inputDescription: form.inputDescription || null,
        outputDescription: form.outputDescription || null,
        constraints: form.constraints || null,
        timeLimitSeconds: Number(form.timeLimitSeconds),
        memoryLimitMb: Number(form.memoryLimitMb),
        status: creating ? 'draft' : selected?.status ?? 'draft',
        ...(testCasesChanged ? {
          testCases: caseRows,
          testCasesRevision: creating ? 0 : selected?.testCaseRevision ?? testCases?.revision ?? 0,
        } : {}),
        ...(editorialsChanged ? { editorials: editorialRows } : {}),
      }
      const saved = creating
        ? await createOrganizationProblem(api, slug, input)
        : selected
          ? await updateOrganizationProblem(api, slug, selected.id, input)
          : null
      if (!saved) return
      if (creating) {
        setPage(1)
        setSearch('')
        setQuery('')
      }
      setSelectedId(saved.id)
      setCreating(false)
      setEditing(false)
      setNotice(t('organizationContentSaved'))
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function changeProblemStatus(problem: OrganizationProblem, status: OrganizationProblem['status']) {
    if (busy || !window.confirm(t('organizationContentConfirmStatus'))) return
    setBusy(true)
    setError('')
    try {
      await setOrganizationProblemStatus(api, slug, problem.id, status)
      setReloadKey((key) => key + 1)
      setSelectedId(problem.id)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function removeProblem(problem: OrganizationProblem) {
    if (busy || !window.confirm(t('organizationContentConfirmDelete'))) return
    setBusy(true)
    setError('')
    try {
      await deleteOrganizationProblem(api, slug, problem.id)
      setSelectedId('')
      setSelected(null)
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function submitGrant(event: FormEvent) {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await createOrganizationProblemGrant(api, slug, selected.id, {
        scope: grantScope,
        ...(grantScope === 'ORGANIZATION' ? { granteeOrganizationId: granteeId } : {}),
      })
      await loadGrants(selected.id)
      setNotice(t('organizationContentGrantSaved'))
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function revokeGrant(grant: OrganizationProblemGrant) {
    if (!selected || busy || !window.confirm(t('organizationContentConfirmRevoke'))) return
    setBusy(true)
    setError('')
    try {
      await revokeOrganizationProblemGrant(api, slug, selected.id, grant.id)
      await loadGrants(selected.id)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  const showForm = creating || Boolean(editing && selected)

  return (
    <section className={`${styles.panel} ${adminDetail ? styles.adminDetailPanel : ''}`} aria-labelledby="organization-problems-title">
      <header className={styles.header}>
        <div>
          <h2 id="organization-problems-title">{t('organizationManageProblems')}</h2>
          {showGuidance && <p>{t('organizationContentProblemsHint')}</p>}
        </div>
        {canManage && !archived && (
          <button type="button" className={styles.primary} onClick={startCreate} disabled={busy}>
            {t('organizationContentCreateProblem')}
          </button>
        )}
      </header>
      <div className={styles.toolbar}>
        <label>
          <span>{t('organizationContentSearch')}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading && !showForm && !selected
        ? <p className={styles.empty}>{t('organizationContentLoading')}</p>
        : !showForm && !selected && items.length === 0 && !error
          ? showEmptyStateText ? <p className={styles.empty}>{t('organizationTabNoData_problems')}</p> : null
          : (
        <div className={`${styles.grid} ${adminDetail && showForm ? styles.formOpenGrid : ''}`}>
          <ul className={styles.list}>
            {items.map((problem) => (
              <li key={problem.id}>
                <button
                  type="button"
                  className={`${styles.listItem} ${selectedId === problem.id ? styles.selected : ''}`}
                  onClick={() => { setSelectedId(problem.id); setCreating(false); setEditing(false); setError(''); setNotice('') }}
                >
                  <strong>{problem.code}</strong><span>{problem.title}</span>
                  {canManage && <small>{t(`organizationProblemStatus_${problem.status}`)}</small>}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.content}>
            {showForm ? (
              <form className={`${styles.form} ${adminDetail ? styles.adminDetailForm : ''}`} onSubmit={(event) => void saveProblem(event)}>
                <h3>{creating ? t('organizationContentCreateProblem') : t('organizationContentEditProblem')}</h3>
                <label>{t('organizationContentCode')}<input required maxLength={50} value={form.code} disabled={!creating} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
                <label>{t('organizationContentTitle')}<input required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentSummary')}<input maxLength={200} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentStatement')}<textarea required rows={7} maxLength={100000} value={form.statement} onChange={(event) => setForm({ ...form, statement: event.target.value })} /></label>
                <div className={styles.twoCols}>
                  <label>{t('organizationContentDifficulty')}<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as ProblemForm['difficulty'] })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
                  <label>{t('organizationContentTimeLimit')}<input type="number" min="0.1" max="600" step="0.1" required value={form.timeLimitSeconds} onChange={(event) => setForm({ ...form, timeLimitSeconds: event.target.value })} /></label>
                  <label>{t('organizationContentMemoryLimit')}<input type="number" min="16" max="65536" required value={form.memoryLimitMb} onChange={(event) => setForm({ ...form, memoryLimitMb: event.target.value })} /></label>
                  <label>{t('organizationContentLanguages')}<input required value={form.languages} placeholder="C++17, Python 3" onChange={(event) => setForm({ ...form, languages: event.target.value })} /></label>
                </div>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentTags')}<input value={form.tags} placeholder="array, sorting" onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
                <div className={styles.twoCols}>
                  <label>{t('organizationContentInputDescription')}<textarea rows={3} value={form.inputDescription} onChange={(event) => setForm({ ...form, inputDescription: event.target.value })} /></label>
                  <label>{t('organizationContentOutputDescription')}<textarea rows={3} value={form.outputDescription} onChange={(event) => setForm({ ...form, outputDescription: event.target.value })} /></label>
                </div>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentConstraints')}<textarea rows={3} value={form.constraints} onChange={(event) => setForm({ ...form, constraints: event.target.value })} /></label>
                <fieldset>
                  <legend>{t('organizationContentTestCases')}</legend>
                  {caseRows.map((testCase, index) => <div className={styles.caseEditor} key={testCase.id ?? `new-${index}`}>
                    <div className={styles.twoCols}>
                      <label>{t('organizationContentTestName')}<input required maxLength={100} value={testCase.name} onChange={(event) => setCaseRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} /></label>
                      <label>{t('organizationContentTestType')}<select value={testCase.kind} onChange={(event) => setCaseRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, kind: event.target.value as TestCaseForm['kind'] } : row))}><option value="sample">{t('organizationContentSample')}</option><option value="hidden">{t('organizationContentHidden')}</option></select></label>
                      <label>{t('organizationContentTestInput')}<textarea required rows={3} value={testCase.input} onChange={(event) => setCaseRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, input: event.target.value } : row))} /></label>
                      <label>{t('organizationContentTestOutput')}<textarea required rows={3} value={testCase.expectedOutput} onChange={(event) => setCaseRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, expectedOutput: event.target.value } : row))} /></label>
                    </div>
                    <button className={styles.danger} type="button" disabled={busy} onClick={() => setCaseRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>{t('organizationContentRemoveTest')}</button>
                  </div>)}
                  <div className={styles.actions}>
                    <button className={styles.secondary} type="button" disabled={busy} onClick={() => setCaseRows((rows) => [...rows, { name: `Sample ${rows.length + 1}`, input: '', expectedOutput: '', kind: 'sample' }])}>{t('organizationContentAddSample')}</button>
                    <button className={styles.secondary} type="button" disabled={busy} onClick={() => setCaseRows((rows) => [...rows, { name: `Hidden ${rows.length + 1}`, input: '', expectedOutput: '', kind: 'hidden' }])}>{t('organizationContentAddHidden')}</button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t('organizationContentEditorials')}</legend>
                  {editorialRows.map((editorial, index) => <div className={styles.caseEditor} key={editorial.id ?? `editorial-${index}`}>
                    <label>{t('organizationContentEditorialTitle')}<input required maxLength={160} value={editorial.title} onChange={(event) => setEditorialRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
                    <label>{t('organizationContentEditorialLanguage')}<input required maxLength={100} value={editorial.language} onChange={(event) => setEditorialRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, language: event.target.value } : row))} /></label>
                    <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentEditorialCode')}<textarea required rows={5} maxLength={100000} value={editorial.sourceCode} onChange={(event) => setEditorialRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, sourceCode: event.target.value } : row))} /></label>
                    <button className={styles.danger} type="button" disabled={busy} onClick={() => setEditorialRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>{t('organizationContentRemoveEditorial')}</button>
                  </div>)}
                  <button className={styles.secondary} type="button" disabled={busy} onClick={() => setEditorialRows((rows) => [...rows, { title: '', language: '', sourceCode: '' }])}>{t('organizationContentAddEditorial')}</button>
                </fieldset>
                {testCases && <p className={styles.muted}>{t('organizationContentTestRevision', { revision: testCases.revision })}</p>}
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={busy} type="submit">{busy ? t('organizationContentSaving') : t('organizationManageSave')}</button>
                  <button className={styles.secondary} disabled={busy} type="button" onClick={() => { setEditing(false); setCreating(false) }}>{t('organizationContentCancel')}</button>
                </div>
              </form>
            ) : selected ? (
              <article>
                <div className={styles.detailHeading}>
                  <div><h3>{selected.title}</h3><p>{selected.code} · {t(`organizationProblemStatus_${selected.status}`)}</p></div>
                  {canManage && !archived && <button className={styles.secondary} type="button" onClick={() => setEditing(true)}>{t('organizationContentEdit')}</button>}
                </div>
                <p>{selected.summary}</p>
                <pre className={styles.statement}>{selected.statement}</pre>
                {selected.examples.map((example) => <div key={example.id} className={styles.example}><strong>{t('organizationContentSample')}</strong><pre>{example.input}</pre><pre>{example.output}</pre></div>)}
                {!archived && selected.status === 'published' && (
                  <p><Link className={styles.inlineLink} to={`/organizations/${encodeURIComponent(slug)}/problems/${encodeURIComponent(selected.id)}/submit`}>{t('organizationSubmitSolution')}</Link></p>
                )}
                {canManage && !archived && (
                  <div className={styles.actions}>
                    {selected.status !== 'published' && <button className={styles.primary} disabled={busy} type="button" onClick={() => void changeProblemStatus(selected, 'published')}>{t('organizationContentPublish')}</button>}
                    {selected.status === 'published' && <button className={styles.secondary} disabled={busy} type="button" onClick={() => void changeProblemStatus(selected, 'archived')}>{t('organizationContentArchive')}</button>}
                    {selected.status === 'archived' && <button className={styles.secondary} disabled={busy} type="button" onClick={() => void changeProblemStatus(selected, 'draft')}>{t('organizationContentRestore')}</button>}
                    {selected.status === 'draft' && <button className={styles.danger} disabled={busy} type="button" onClick={() => void removeProblem(selected)}>{t('organizationContentDelete')}</button>}
                    <button className={styles.secondary} disabled={busy} type="button" onClick={() => { setShowGrants((open) => !open); if (!showGrants) void loadGrants(selected.id) }}>{t('organizationContentGrants')}</button>
                  </div>
                )}
                {showGrants && canManage && (
                  <section className={styles.grants}>
                    <h4>{t('organizationContentGrantHistory')}</h4>
                    <form className={styles.toolbar} onSubmit={(event) => void submitGrant(event)}>
                      <label>{t('organizationContentGrantScope')}<select value={grantScope} onChange={(event) => setGrantScope(event.target.value as typeof grantScope)}><option value="ORGANIZATION">{t('organizationContentGrantOrg')}</option><option value="GLOBAL_CONTESTS">{t('organizationContentGrantGlobal')}</option></select></label>
                      {grantScope === 'ORGANIZATION' && <label>{t('organizationContentGrantTarget')}<select required value={granteeId} onChange={(event) => setGranteeId(event.target.value)}><option value="">{t('organizationContentSelectOrganization')}</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}
                      <button className={styles.primary} disabled={busy || archived} type="submit">{t('organizationContentGrant')}</button>
                    </form>
                    {grants.length === 0 ? <p className={styles.muted}>{t('organizationContentNoGrants')}</p> : (
                      <ul className={styles.grantList}>{grants.map((grant) => <li key={grant.id}>
                        <span>{grant.scope === 'GLOBAL_CONTESTS' ? t('organizationContentGrantGlobal') : grant.granteeOrganization?.name}</span>
                        <small>{grant.revokedAt ? t('organizationContentRevoked') : t('organizationContentActive')} · {new Date(grant.grantedAt).toLocaleString()}</small>
                        {!grant.revokedAt && <button className={styles.danger} disabled={busy || archived} type="button" onClick={() => void revokeGrant(grant)}>{t('organizationContentRevoke')}</button>}
                      </li>)}</ul>
                    )}
                  </section>
                )}
              </article>
            ) : (
              <p className={styles.empty}>{t('organizationContentSelectItem')}</p>
            )}
          </div>
        </div>
      )}
      <footer className={styles.pagination}>
        <span>{t('organizationContentResultCount', { count: total })}</span>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('organizationContentPrevious')}</button>
          <button className={styles.secondary} type="button" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>{t('organizationContentNext')}</button>
        </div>
      </footer>
    </section>
  )
}

function ContestPanel({
  slug,
  canManage,
  archived,
  showGuidance = true,
  showEmptyStateText = true,
  adminDetail = false,
}: Omit<Props, 'section'>) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [items, setItems] = useState<OrganizationContest[]>([])
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<OrganizationContest | null>(null)
  const [form, setForm] = useState(EMPTY_CONTEST)
  const [options, setOptions] = useState<OrganizationContestProblemOption[]>([])
  const [selectedProblems, setSelectedProblems] = useState<string[]>([])
  const [problemContent, setProblemContent] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    listOrganizationContests(api, slug, { page: 1, pageSize: 50, search }, controller.signal)
      .then((result) => {
        setItems(result.items)
        if (selectedId && !result.items.some((item) => item.id === selectedId)) {
          setSelectedId('')
          setSelected(null)
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, t('organizationContentLoadError')))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, reloadKey, search, selectedId, slug, t])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    getOrganizationContest(api, slug, selectedId, controller.signal)
      .then((contest) => {
        setSelected(contest)
        setForm({
          slug: contest.slug,
          title: contest.title,
          description: contest.description ?? '',
          rules: contest.rules ?? '',
          startsAt: toLocalDateTime(contest.startsAt),
          endsAt: toLocalDateTime(contest.endsAt),
          visibility: contest.visibility,
        })
        setSelectedProblems(contest.problems.map((problem) => problem.problemId))
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught, t('organizationContentLoadError')))
      })
    return () => controller.abort()
  }, [api, selectedId, slug, t])

  useEffect(() => {
    if (!canManage) return
    listOrganizationContestProblemOptions(api, slug)
      .then(setOptions)
      .catch((caught: unknown) => setError(errorMessage(caught, t('organizationContentLoadError'))))
  }, [api, canManage, reloadKey, slug, t])

  function startCreate() {
    setSelectedId('')
    setSelected(null)
    setCreating(true)
    setEditing(false)
    setForm(EMPTY_CONTEST)
    setSelectedProblems([])
    setError('')
    setNotice('')
  }

  async function saveContest(event: FormEvent) {
    event.preventDefault()
    if (busy || !canManage || archived) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const input = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        rules: form.rules.trim() || null,
        startsAt: toIsoDateTime(form.startsAt),
        endsAt: toIsoDateTime(form.endsAt),
        visibility: form.visibility,
      }
      const contest = creating
        ? await createOrganizationContest(api, slug, input)
        : selected
          ? await updateOrganizationContest(api, slug, selected.id, input)
          : null
      if (!contest) return
      const problems = selectedProblems.map((problemId) => ({ problemId, maxScore: 100 }))
      await replaceOrganizationContestProblems(api, slug, contest.id, problems)
      setSelectedId(contest.id)
      setCreating(false)
      setEditing(false)
      setNotice(t('organizationContentSaved'))
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function performContestAction(action: 'publish' | 'archive' | 'restore', contest: OrganizationContest) {
    if (busy || !window.confirm(t('organizationContentConfirmStatus'))) return
    setBusy(true)
    setError('')
    try {
      const updated = action === 'publish'
        ? await publishOrganizationContest(api, slug, contest.id)
        : action === 'archive'
          ? await archiveOrganizationContest(api, slug, contest.id)
          : await restoreOrganizationContest(api, slug, contest.id)
      setSelected(updated)
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentSaveError')))
    } finally {
      setBusy(false)
    }
  }

  async function toggleProblemContent(problemId: string) {
    if (problemContent[problemId] !== undefined) {
      setProblemContent((current) => {
        const next = { ...current }
        delete next[problemId]
        return next
      })
      return
    }
    if (!selected) return
    setError('')
    try {
      const content = await getOrganizationContestProblem(api, slug, selected.id, problemId)
      setProblemContent((current) => ({ ...current, [problemId]: content.statement }))
    } catch (caught) {
      setError(errorMessage(caught, t('organizationContentProblemUnavailable')))
    }
  }

  const showForm = creating || Boolean(editing && selected)

  return (
    <section className={`${styles.panel} ${adminDetail ? styles.adminDetailPanel : ''}`} aria-labelledby="organization-contests-title">
      <header className={styles.header}>
        <div>
          <h2 id="organization-contests-title">{t('organizationManageContests')}</h2>
          {showGuidance && <p>{t('organizationContentContestsHint')}</p>}
        </div>
        {canManage && !archived && <button type="button" className={styles.primary} disabled={busy} onClick={startCreate}>{t('organizationContentCreateContest')}</button>}
      </header>
      <div className={styles.toolbar}><label><span>{t('organizationContentSearch')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading && !showForm && !selected
        ? <p className={styles.empty}>{t('organizationContentLoading')}</p>
        : !showForm && !selected && items.length === 0 && !error
          ? showEmptyStateText ? <p className={styles.empty}>{t('organizationTabNoData_contests')}</p> : null
          : (
        <div className={`${styles.grid} ${adminDetail && showForm ? styles.formOpenGrid : ''}`}>
          <ul className={styles.list}>{items.map((contest) => <li key={contest.id}>
            <button type="button" className={`${styles.listItem} ${selectedId === contest.id ? styles.selected : ''}`} onClick={() => { setSelectedId(contest.id); setCreating(false); setEditing(false); setError('') }}>
              <strong>{contest.title}</strong><span>{contest.slug}</span><small>{contest.publicationStatus} · {contest.visibility}</small>
            </button>
          </li>)}</ul>
          <div className={styles.content}>
            {showForm ? (
              <form className={`${styles.form} ${adminDetail ? styles.adminDetailForm : ''}`} onSubmit={(event) => void saveContest(event)}>
                <h3>{creating ? t('organizationContentCreateContest') : t('organizationContentEditContest')}</h3>
                <label>{t('organizationContentSlug')}<input required maxLength={120} value={form.slug} disabled={Boolean(selected?.publishedAt)} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
                <label>{t('organizationContentTitle')}<input required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentDescription')}<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentRules')}<textarea rows={3} value={form.rules} onChange={(event) => setForm({ ...form, rules: event.target.value })} /></label>
                <div className={styles.twoCols}>
                  <label>{t('organizationContentStartsAt')}<input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
                  <label>{t('organizationContentEndsAt')}<input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
                </div>
                <label className={adminDetail ? styles.wideFormField : undefined}>{t('organizationContentVisibility')}<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as ContestForm['visibility'] })}><option value="PUBLIC">{t('organizationVisibilityPublic')}</option><option value="PRIVATE">{t('organizationVisibilityPrivate')}</option></select></label>
                <fieldset><legend>{t('organizationContentContestProblems')}</legend>
                  {options.length === 0 ? <p className={styles.muted}>{t('organizationContentNoProblemOptions')}</p> : (
                    <ul className={styles.optionList}>{options.map((option) => <li key={option.id}>
                      <label><input type="checkbox" checked={selectedProblems.includes(option.id)} onChange={(event) => setSelectedProblems((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} />
                        <span><strong>{option.code}</strong> — {option.title}<small>{option.organizationName ?? t('organizationContentGlobalProblem')}</small></span>
                      </label>
                    </li>)}</ul>
                  )}
                </fieldset>
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={busy}>{busy ? t('organizationContentSaving') : t('organizationManageSave')}</button>
                  <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setCreating(false); setEditing(false) }}>{t('organizationContentCancel')}</button>
                </div>
              </form>
            ) : selected ? (
              <article>
                <div className={styles.detailHeading}>
                  <div><h3>{selected.title}</h3><p>{selected.publicationStatus} · {selected.visibility}</p></div>
                  {canManage && !archived && selected.publicationStatus !== 'ARCHIVED' && <button className={styles.secondary} type="button" onClick={() => setEditing(true)}>{t('organizationContentEdit')}</button>}
                </div>
                <p>{selected.description}</p>
                <p>{new Date(selected.startsAt).toLocaleString()} – {new Date(selected.endsAt).toLocaleString()}</p>
                <h4>{t('organizationContentContestProblems')}</h4>
                {selected.problems.length === 0 ? <p className={styles.muted}>{t('organizationContentNoContestProblems')}</p> : (
                  <ol className={styles.problemList}>{selected.problems.map((problem) => {
                    const ongoing = selected.publicationStatus === 'PUBLISHED'
                      && Date.now() >= Date.parse(selected.startsAt)
                      && Date.now() < Date.parse(selected.endsAt)
                    return <li key={problem.problemId}>
                      <button type="button" className={styles.inlineLink} onClick={() => void toggleProblemContent(problem.problemId)}>{problem.problemCode} — {problem.problemTitle}</button>
                      {ongoing && !archived && <Link className={styles.inlineLink} to={`/organizations/${encodeURIComponent(slug)}/contests/${encodeURIComponent(selected.id)}/problems/${encodeURIComponent(problem.problemId)}/submit`}>{t('organizationSubmitSolution')}</Link>}
                      {problemContent[problem.problemId] !== undefined && <pre className={styles.statement}>{problemContent[problem.problemId]}</pre>}
                    </li>
                  })}</ol>
                )}
                {canManage && !archived && <div className={styles.actions}>
                  {selected.publicationStatus === 'DRAFT' && <button className={styles.primary} disabled={busy} type="button" onClick={() => void performContestAction('publish', selected)}>{t('organizationContentPublish')}</button>}
                  {selected.publicationStatus === 'PUBLISHED' && <button className={styles.secondary} disabled={busy} type="button" onClick={() => void performContestAction('archive', selected)}>{t('organizationContentArchive')}</button>}
                  {selected.publicationStatus === 'ARCHIVED' && <button className={styles.secondary} disabled={busy} type="button" onClick={() => void performContestAction('restore', selected)}>{t('organizationContentRestore')}</button>}
                </div>}
                {selected.publicationStatus === 'ARCHIVED' && <p className={styles.muted}>{t('organizationContentArchivedHistory')}</p>}
              </article>
            ) : <p className={styles.empty}>{t('organizationContentSelectItem')}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

export default function OrganizationContentPanel(props: Props) {
  return props.section === 'problems'
    ? <ProblemPanel {...props} />
    : <ContestPanel {...props} />
}
