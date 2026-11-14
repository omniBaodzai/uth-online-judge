// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationContentPanel from './OrganizationContentPanel'
import styles from './OrganizationContentPanel.module.css'
import {
  getOrganizationContest,
  getOrganizationProblem,
  getOrganizationProblemTestCases,
  listOrganizationContestProblemOptions,
  listOrganizationContests,
  listOrganizationProblems,
} from '../organizations-api'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  translate: (key: string) => key,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}))

vi.mock('../useOrganizationsApi', () => ({
  useOrganizationsApi: () => mocks.api,
}))

vi.mock('../organizations-api', () => ({
  errorMessage: (_error: unknown, fallback: string) => fallback,
  listOrganizationProblems: vi.fn(),
  getOrganizationProblem: vi.fn(),
  getOrganizationProblemTestCases: vi.fn(),
  listOrganizationProblemGrants: vi.fn(),
  listOrganizations: vi.fn(),
  listOrganizationContests: vi.fn(),
  getOrganizationContest: vi.fn(),
  listOrganizationContestProblemOptions: vi.fn(),
}))

const problem = {
  id: 'problem-1',
  code: 'navi_1',
  title: 'NAVI Problem',
  summary: null,
  statement: 'Problem statement',
  difficulty: 'easy',
  tags: [],
  languages: [],
  inputDescription: '',
  outputDescription: '',
  constraints: '',
  timeLimitSeconds: 2,
  memoryLimitMb: 256,
  testCaseRevision: 0,
  status: 'draft',
  examples: [],
  editorials: [],
}

const contest = {
  id: 'contest-1',
  slug: 'navi_contest',
  title: 'NAVI Contest',
  description: null,
  rules: null,
  startsAt: '2027-01-01T00:00:00.000Z',
  endsAt: '2027-01-02T00:00:00.000Z',
  publicationStatus: 'DRAFT',
  visibility: 'PUBLIC',
  allowRegistration: true,
  showLeaderboard: true,
  publishedAt: null,
  problems: [],
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listOrganizationProblems).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  })
  vi.mocked(listOrganizationContests).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
  })
  vi.mocked(listOrganizationContestProblemOptions).mockResolvedValue([])
  vi.mocked(getOrganizationProblem).mockResolvedValue(problem as never)
  vi.mocked(getOrganizationProblemTestCases).mockResolvedValue({ revision: 0, cases: [] })
  vi.mocked(getOrganizationContest).mockResolvedValue(contest as never)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderPanel(section: 'problems' | 'contests', adminDetail = false) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <OrganizationContentPanel
          slug="naviwebsite"
          section={section}
          canManage
          archived={false}
          adminDetail={adminDetail}
        />
      </MemoryRouter>,
    )
  })
}

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function clickButton(name: string) {
  const button = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.trim() === name)
  expect(button).toBeDefined()
  act(() => button?.click())
}

function clickListItem(text: string) {
  const button = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.includes(text))
  expect(button).toBeDefined()
  act(() => button?.click())
}

function expectForm(title: string) {
  expect([...container.querySelectorAll('h3')].some((heading) => heading.textContent === title)).toBe(true)
  expect(container.querySelector('form')).not.toBeNull()
}

describe('OrganizationContentPanel create interactions', () => {
  it('opens, cancels, and reopens the problem form when the organization has no problems', async () => {
    await renderPanel('problems')
    await flushEffects()
    expect(container.textContent).toContain('organizationTabNoData_problems')

    clickButton('organizationContentCreateProblem')
    expectForm('organizationContentCreateProblem')
    clickButton('organizationContentCancel')
    expect(container.textContent).toContain('organizationTabNoData_problems')

    clickButton('organizationContentCreateProblem')
    expectForm('organizationContentCreateProblem')
  })

  it('uses the Admin detail problem-form layout without changing the existing fields', async () => {
    await renderPanel('problems', true)
    await flushEffects()
    clickButton('organizationContentCreateProblem')

    const form = container.querySelector('form')
    expect(form?.classList.contains(styles.adminDetailForm)).toBe(true)
    expect(container.querySelector(`.${styles.formOpenGrid}`)).not.toBeNull()
    expect(container.textContent).toContain('organizationContentStatement')
    expect(container.textContent).toContain('organizationContentTestCases')
    expect(container.textContent).toContain('organizationContentEditorials')
    expect(container.querySelectorAll('textarea').length).toBeGreaterThan(3)
    expect(mocks.api).not.toHaveBeenCalled()
  })

  it('opens, cancels, and reopens the contest form when the organization has no contests', async () => {
    await renderPanel('contests')
    await flushEffects()
    expect(container.textContent).toContain('organizationTabNoData_contests')

    clickButton('organizationContentCreateContest')
    expectForm('organizationContentCreateContest')
    clickButton('organizationContentCancel')
    expect(container.textContent).toContain('organizationTabNoData_contests')

    clickButton('organizationContentCreateContest')
    expectForm('organizationContentCreateContest')
  })

  it('uses the Admin detail contest-form layout and preserves date and problem selection controls', async () => {
    vi.mocked(listOrganizationContestProblemOptions).mockResolvedValue([{
      id: 'hidden-global-problem',
      code: 'GLOBAL_1',
      title: 'Hidden published Global problem',
      organizationName: null,
    }] as never)
    await renderPanel('contests', true)
    await flushEffects()
    clickButton('organizationContentCreateContest')
    await flushEffects()

    const form = container.querySelector('form')
    expect(form?.classList.contains(styles.adminDetailForm)).toBe(true)
    expect(container.querySelector(`.${styles.formOpenGrid}`)).not.toBeNull()
    expect(container.querySelectorAll('input[type="datetime-local"]')).toHaveLength(2)
    expect(container.textContent).toContain('organizationContentContestProblems')
    expect(container.textContent).toContain('Hidden published Global problem')
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
    expect(mocks.api).not.toHaveBeenCalled()
  })

  it('keeps the problem form available while the initial list request is loading', async () => {
    vi.mocked(listOrganizationProblems).mockReturnValue(new Promise(() => {}))
    await renderPanel('problems')
    expect(container.textContent).toContain('organizationContentLoading')

    clickButton('organizationContentCreateProblem')
    expectForm('organizationContentCreateProblem')
  })

  it('keeps the contest form available while the initial list request is loading', async () => {
    vi.mocked(listOrganizationContests).mockReturnValue(new Promise(() => {}))
    await renderPanel('contests')
    expect(container.textContent).toContain('organizationContentLoading')

    clickButton('organizationContentCreateContest')
    expectForm('organizationContentCreateContest')
  })

  it('switches between problem detail, edit form, cancel, and create form', async () => {
    vi.mocked(listOrganizationProblems).mockResolvedValue({
      items: [problem as never],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await renderPanel('problems')
    await flushEffects()

    clickListItem('navi_1')
    await flushEffects()
    expect(container.textContent).toContain('Problem statement')

    clickButton('organizationContentEdit')
    expectForm('organizationContentEditProblem')
    clickButton('organizationContentCancel')
    expect(container.textContent).toContain('Problem statement')

    clickButton('organizationContentCreateProblem')
    expectForm('organizationContentCreateProblem')
    clickButton('organizationContentCancel')
    await flushEffects()
    clickListItem('navi_1')
    await flushEffects()
    expect(container.textContent).toContain('Problem statement')
  })

  it('switches between contest detail, edit form, cancel, and create form', async () => {
    vi.mocked(listOrganizationContests).mockResolvedValue({
      items: [contest as never],
      total: 1,
      page: 1,
      pageSize: 50,
    })
    await renderPanel('contests')
    await flushEffects()

    clickListItem('NAVI Contest')
    await flushEffects()
    expect(container.textContent).toContain('organizationContentContestProblems')

    clickButton('organizationContentEdit')
    expectForm('organizationContentEditContest')
    clickButton('organizationContentCancel')
    expect(container.textContent).toContain('organizationContentContestProblems')

    clickButton('organizationContentCreateContest')
    expectForm('organizationContentCreateContest')
    clickButton('organizationContentCancel')
    await flushEffects()
    clickListItem('NAVI Contest')
    await flushEffects()
    expect(container.textContent).toContain('organizationContentContestProblems')
  })
})
