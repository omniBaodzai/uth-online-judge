// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../auth/api'
import AdminContestFormPage from './AdminContestFormPage'

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    replaceProblems: vi.fn(),
    publish: vi.fn(),
    listProblems: vi.fn(),
  },
  setNotice: vi.fn(),
}))

vi.mock('../useAdmin', () => ({
  useAdmin: () => ({ setNotice: mocks.setNotice }),
}))

vi.mock('./useContestAdmin', () => ({
  useContestAdmin: () => mocks.api,
}))

const problem = {
  problemId: 'problem-1',
  problemCode: 'P-001',
  problemTitle: 'Sample problem',
  difficulty: 'easy' as const,
  maxScore: 100,
}

function contest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contest-1',
    slug: 'test-contest',
    title: 'Test contest',
    description: null,
    rules: null,
    startsAt: '2026-11-15T02:00:00.000Z',
    endsAt: '2026-11-15T04:00:00.000Z',
    publicationStatus: 'DRAFT',
    visibility: 'PUBLIC',
    allowRegistration: true,
    showLeaderboard: true,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: '2026-11-14T08:00:00.000Z',
    updatedAt: '2026-11-14T08:00:00.000Z',
    publishedAt: null,
    participantCount: 0,
    problems: [],
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T10:00:00.000Z'))
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.api.get.mockResolvedValue(contest())
  mocks.api.create.mockResolvedValue(contest({ id: 'created-contest' }))
  mocks.api.update.mockResolvedValue(contest())
  mocks.api.replaceProblems.mockResolvedValue([problem])
  mocks.api.publish.mockResolvedValue(contest({ publicationStatus: 'PUBLISHED' }))
  mocks.api.listProblems.mockResolvedValue({
    items: [{
      id: problem.problemId,
      code: problem.problemCode,
      title: problem.problemTitle,
      difficulty: problem.difficulty,
      score: problem.maxScore,
    }],
    total: 1,
    page: 1,
    pageSize: 100,
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function renderPage(path = '/admin/contests/new') {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/admin/contests/new" element={<AdminContestFormPage />} />
          <Route path="/admin/contests/:contestId/edit" element={<AdminContestFormPage />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

function setInput(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Input not found: ${selector}`)
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button'))
    .find((item) => item.textContent?.trim() === label)
  if (!found) throw new Error(`Button not found: ${label}`)
  return found
}

async function clickAndFlush(target: HTMLElement) {
  await act(async () => {
    target.click()
    await vi.runAllTimersAsync()
  })
}

function fillNewContest(startsAt = '2026-11-15T09:00', endsAt = '2026-11-15T11:00') {
  setInput('#contest-title', 'Test contest')
  setInput('#contest-slug', 'test-contest')
  setInput('#contest-startsAt', startsAt)
  setInput('#contest-endsAt', endsAt)
}

async function addProblem() {
  await clickAndFlush(button('Thêm bài tập'))
  const checkbox = container.querySelector<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')
  if (!checkbox) throw new Error('Problem checkbox not found')
  await clickAndFlush(checkbox)
  await clickAndFlush(button('Xác nhận'))
}

describe('AdminContestFormPage save flow', () => {
  it('blocks publishing at the current time without sending a request or losing input', async () => {
    renderPage()
    fillNewContest('2026-11-14T17:00', '2026-11-15T17:00')

    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.create).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLInputElement>('#contest-startsAt')?.value).toBe('2026-11-14T17:00')
    expect(container.textContent).toContain('Thời gian bắt đầu phải lớn hơn thời gian hiện tại')
  })

  it('allows saving a past-timed draft when it does not need a problem-list update', async () => {
    renderPage()
    fillNewContest('2026-11-14T09:00', '2026-11-14T11:00')

    await clickAndFlush(button('Lưu bản nháp'))

    expect(mocks.api.create).toHaveBeenCalledOnce()
    expect(mocks.api.create.mock.calls[0]?.[0].startsAt).toBe('2026-11-14T02:00:00.000Z')
    expect(mocks.api.publish).not.toHaveBeenCalled()
  })

  it('preserves selected problems and continues from the created ID after a problem-save failure', async () => {
    const savedDraft = contest({ id: 'created-contest' })
    mocks.api.create.mockResolvedValue(savedDraft)
    mocks.api.get.mockResolvedValue(savedDraft)
    mocks.api.update.mockResolvedValue(savedDraft)
    mocks.api.replaceProblems.mockRejectedValueOnce(new ApiError(
      'Không thể thay đổi bài tập sau khi cuộc thi bắt đầu.',
      409,
    ))
    mocks.api.publish.mockResolvedValue(contest({
      id: 'created-contest',
      publicationStatus: 'PUBLISHED',
      publishedAt: '2026-11-14T10:05:00.000Z',
    }))

    renderPage()
    fillNewContest()
    await addProblem()
    await clickAndFlush(button('Xuất bản'))

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/admin/contests/created-contest/edit')
    expect(mocks.api.create).toHaveBeenCalledOnce()
    expect(mocks.api.replaceProblems).toHaveBeenCalledOnce()
    expect(mocks.api.publish).not.toHaveBeenCalled()
    expect(mocks.setNotice).toHaveBeenCalledWith(expect.stringContaining('Các lựa chọn vẫn được giữ'))

    expect(container.querySelector<HTMLInputElement>('#contest-title')?.value).toBe('Test contest')
    expect(container.textContent).toContain('Sample problem')
    mocks.api.replaceProblems.mockResolvedValue([problem])

    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.create).toHaveBeenCalledOnce()
    expect(mocks.api.update).toHaveBeenCalledOnce()
    expect(mocks.api.replaceProblems).toHaveBeenCalledTimes(2)
    expect(mocks.api.publish).toHaveBeenCalledOnce()
  })

  it('does not repeat an uncertain create request from the same form', async () => {
    mocks.api.create.mockRejectedValueOnce(new ApiError('Network error', 0))
    renderPage()
    fillNewContest()

    await clickAndFlush(button('Lưu bản nháp'))
    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.create).toHaveBeenCalledOnce()
    expect(container.querySelector<HTMLInputElement>('#contest-title')?.value).toBe('Test contest')
    expect(container.textContent).toContain('Không xác định được máy chủ đã tạo cuộc thi hay chưa')
    expect(container.textContent).toContain('Mở danh sách cuộc thi để kiểm tra')
    expect(button('Lưu bản nháp').disabled).toBe(true)
    expect(button('Xuất bản').disabled).toBe(true)
  })

  it('does not update problems when unchanged and never continues after a PATCH failure', async () => {
    const existing = contest({ problems: [problem] })
    mocks.api.get.mockResolvedValue(existing)
    mocks.api.update.mockRejectedValueOnce(new ApiError('Update rejected', 403))

    renderPage('/admin/contests/contest-1/edit')
    await act(async () => { await vi.runAllTimersAsync() })
    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.update).toHaveBeenCalledOnce()
    expect(mocks.api.replaceProblems).not.toHaveBeenCalled()
    expect(mocks.api.publish).not.toHaveBeenCalled()
  })

  it('does not replace an unchanged problem list when publishing needs a retry', async () => {
    const existing = contest({ problems: [problem] })
    mocks.api.get.mockResolvedValue(existing)
    mocks.api.update.mockResolvedValue(existing)
    mocks.api.publish.mockRejectedValueOnce(new ApiError('Temporary publish failure', 503))

    renderPage('/admin/contests/contest-1/edit')
    await act(async () => { await vi.runAllTimersAsync() })
    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.replaceProblems).not.toHaveBeenCalled()
    expect(mocks.api.publish).toHaveBeenCalledOnce()
    mocks.api.publish.mockResolvedValueOnce(contest({ publicationStatus: 'PUBLISHED' }))

    await clickAndFlush(button('Xuất bản'))

    expect(mocks.api.replaceProblems).not.toHaveBeenCalled()
    expect(mocks.api.publish).toHaveBeenCalledTimes(2)
  })

  it('blocks problem changes locally after a contest has started', async () => {
    mocks.api.get.mockResolvedValue(contest({
      publicationStatus: 'PUBLISHED',
      publishedAt: '2026-11-01T08:00:00.000Z',
      startsAt: '2026-11-14T09:00:00.000Z',
      endsAt: '2026-11-14T12:00:00.000Z',
      problems: [problem],
    }))

    renderPage('/admin/contests/contest-1/edit')
    await act(async () => { await vi.runAllTimersAsync() })
    setInput('input[aria-label="Điểm tối đa của P-001"]', '200')
    await clickAndFlush(button('Lưu thay đổi'))

    expect(mocks.api.update).not.toHaveBeenCalled()
    expect(mocks.api.replaceProblems).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Không thể cập nhật danh sách bài tập vì cuộc thi đã bắt đầu')
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Điểm tối đa của P-001"]')?.value).toBe('200')
  })
})
