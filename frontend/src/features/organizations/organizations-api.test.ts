import { describe, expect, it } from 'vitest'
import { ApiError } from '../auth/api'
import {
  classifyRequestError,
  approveOrganizationRequest,
  createOrganizationProblem,
  emptyToNull,
  errorMessage,
  getAdminOrganizationRequest,
  getOrganizationProblem,
  listOrganizationLeaderboard,
  listOrganizations,
  rejectOrganizationRequest,
  submitOrganizationRequest,
  setOrganizationProblemStatus,
  toRequestInput,
  updateOrganizationProblem,
  updateOrganizationVisibility,
  validateRequestField,
  type ApiRequest,
} from './organizations-api'
import { stateFromError } from './useOrganizationDetail'
import {
  addOrganizationMember,
  changeOrganizationMemberRole,
  joinOrganization,
  leaveOrganization,
  memberActions,
  removeOrganizationMember,
} from './organizations-api'
import {
  getOrganizationContestSubmissionLanguages,
  getOrganizationSubmission,
  getOrganizationSubmissionLanguages,
  getOrganizationSubmissionSource,
  listMyOrganizationSubmissions,
  listOrganizationSubmissions,
  submitOrganizationContestSolution,
  submitOrganizationSolution,
} from './organizations-api'

describe('membership api and permissions', () => {
  const calls: Array<{ path: string; init?: RequestInit }> = []
  const api: ApiRequest = async <T,>(path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return {} as T
  }

  it('calls the membership endpoints', async () => {
    calls.length = 0
    await joinOrganization(api, 'khoa cntt')
    await leaveOrganization(api, 'a')
    await addOrganizationMember(api, 'a', 'bob', 'ADMIN')
    await changeOrganizationMemberRole(api, 'a', 'u1', 'MEMBER')
    await removeOrganizationMember(api, 'a', 'u1')
    expect(calls.map((c) => `${c.init?.method} ${c.path}`)).toEqual([
      'POST /organizations/khoa%20cntt/join',
      'POST /organizations/a/leave',
      'POST /organizations/a/members',
      'PATCH /organizations/a/members/u1',
      'DELETE /organizations/a/members/u1',
    ])
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ identifier: 'bob', role: 'ADMIN' })
  })

  it('shows only permitted member actions', () => {
    const sys = { isSystemAdmin: true, role: null }
    const owner = { isSystemAdmin: false, role: 'OWNER' as const }
    const admin = { isSystemAdmin: false, role: 'ADMIN' as const }
    const member = { isSystemAdmin: false, role: 'MEMBER' as const }
    expect(memberActions(sys, 'MEMBER', false)).toEqual({ canChangeRole: true, canRemove: true })
    expect(memberActions(owner, 'ADMIN', false)).toEqual({ canChangeRole: true, canRemove: true })
    expect(memberActions(admin, 'MEMBER', false)).toEqual({ canChangeRole: false, canRemove: true })
    expect(memberActions(admin, 'ADMIN', false)).toEqual({ canChangeRole: false, canRemove: false })
    expect(memberActions(member, 'MEMBER', false)).toEqual({ canChangeRole: false, canRemove: false })
    expect(memberActions(sys, 'OWNER', false)).toEqual({ canChangeRole: false, canRemove: false })
    expect(memberActions(owner, 'MEMBER', true)).toEqual({ canChangeRole: false, canRemove: false })
  })
})

describe('organizations-api helpers', () => {
  it('trims form values and maps phone/wish to API field names', () => {
    expect(toRequestInput({ fullName: ' A ', workplace: ' B ', position: ' C ', phone: ' 0901234567 ', wish: ' D ' })).toEqual({
      fullName: 'A', workplace: 'B', position: 'C', phoneNumber: '0901234567', motivation: 'D',
    })
  })

  it('validates required and phone fields', () => {
    expect(validateRequestField('fullName', '   ')).toBe('required')
    expect(validateRequestField('fullName', 'Nguyen')).toBeNull()
    expect(validateRequestField('phone', 'abc')).toBe('phoneInvalid')
    expect(validateRequestField('phone', '123')).toBe('phoneInvalid')
    expect(validateRequestField('phone', '+84 901 234 567')).toBeNull()
  })

  it('classifies request errors by status', () => {
    expect(classifyRequestError(new Error('x'))).toBe('network')
    expect(classifyRequestError(new ApiError('x', 401))).toBe('session')
    expect(classifyRequestError(new ApiError('x', 409))).toBe('pending')
    expect(classifyRequestError(new ApiError('x', 429))).toBe('rateLimit')
    expect(classifyRequestError(new ApiError('x', 400))).toBe('validation')
    expect(classifyRequestError(new ApiError('x', 500))).toBe('generic')
  })

  it('uses the server message only for ApiError', () => {
    expect(errorMessage(new ApiError('Slug đã tồn tại', 409), 'fallback')).toBe('Slug đã tồn tại')
    expect(errorMessage(new Error('boom'), 'fallback')).toBe('fallback')
  })

  it('converts blank strings to null', () => {
    expect(emptyToNull('  ')).toBeNull()
    expect(emptyToNull(' a ')).toBe('a')
  })

  it('maps detail errors to page states', () => {
    expect(stateFromError(new ApiError('x', 404))).toEqual({ status: 'notFound' })
    expect(stateFromError(new ApiError('x', 403))).toEqual({ status: 'forbidden' })
    expect(stateFromError(new ApiError('x', 401))).toEqual({ status: 'unauthorized' })
    expect(stateFromError(new Error('x'))).toEqual({ status: 'error' })
  })
})

describe('organizations-api requests', () => {
  function recorder() {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const api = (async (path: string, init?: RequestInit) => {
      calls.push({ path, init })
      return {}
    }) as ApiRequest
    return { api, calls }
  }

  it('POSTs the creation request body', async () => {
    const { api, calls } = recorder()
    await submitOrganizationRequest(api, { fullName: 'A', workplace: 'B', position: 'C', phoneNumber: '0901234567', motivation: 'D' })
    expect(calls[0].path).toBe('/organization-requests')
    expect(calls[0].init?.method).toBe('POST')
  })

  it('builds list queries without empty params', async () => {
    const { api, calls } = recorder()
    await listOrganizations(api, { page: 2, pageSize: 10, q: '' })
    expect(calls[0].path).toBe('/organizations?page=2&pageSize=10')
  })

  it('requests a paginated organization leaderboard', async () => {
    const { api, calls } = recorder()
    await listOrganizationLeaderboard(api, 'a b', { page: 2, pageSize: 10 })

    expect(calls[0].path).toBe('/organizations/a%20b/leaderboard?page=2&pageSize=10')
    expect(calls[0].init?.method).toBeUndefined()
  })

  it('uses the organization submission and language endpoints without global fallbacks', async () => {
    const { api, calls } = recorder()
    const payload = { problemCode: 'ORG001', language: 'cpp', sourceCode: 'code' }
    await getOrganizationSubmissionLanguages(api, 'a b', 'problem-id')
    await submitOrganizationSolution(api, 'a b', payload)
    await getOrganizationContestSubmissionLanguages(api, 'a b', 'contest-id', 'problem-id')
    await submitOrganizationContestSolution(api, 'a b', 'contest-id', payload)
    await listOrganizationSubmissions(api, 'a b', { page: 1, pageSize: 10, status: 'ACCEPTED' })
    await listMyOrganizationSubmissions(api, 'a b', { page: 2, pageSize: 10 })
    await getOrganizationSubmission(api, 'a b', 'submission-id')
    await getOrganizationSubmissionSource(api, 'a b', 'submission-id')

    expect(calls.map(({ path, init }) => [path, init?.method])).toEqual([
      ['/organizations/a%20b/submissions/languages/problem-id', undefined],
      ['/organizations/a%20b/submissions', 'POST'],
      ['/organizations/a%20b/contests/contest-id/submission-languages/problem-id', undefined],
      ['/organizations/a%20b/contests/contest-id/submissions', 'POST'],
      ['/organizations/a%20b/submissions?page=1&pageSize=10&status=ACCEPTED', undefined],
      ['/organizations/a%20b/submissions/mine?page=2&pageSize=10', undefined],
      ['/organizations/a%20b/submissions/submission-id', undefined],
      ['/organizations/a%20b/submissions/submission-id/source', undefined],
    ])
  })

  it('creates, edits, publishes, and reads problems through the organization-scoped API', async () => {
    const { api, calls } = recorder()
    const input = {
      code: 'navi_task_1',
      title: 'NAVI task',
      statement: 'Solve the problem.',
      tags: ['array'],
      languages: ['C++'],
      timeLimitSeconds: 2,
      memoryLimitMb: 256,
      testCases: [{ name: 'Sample 1', input: '1', expectedOutput: '1', kind: 'sample' as const }],
      testCasesRevision: 0,
    }

    await createOrganizationProblem(api, 'naviwebsite', input)
    await updateOrganizationProblem(api, 'naviwebsite', 'problem-id', input)
    await setOrganizationProblemStatus(api, 'naviwebsite', 'problem-id', 'published')
    await getOrganizationProblem(api, 'naviwebsite', 'problem-id')

    expect(calls.map(({ path, init }) => [path, init?.method])).toEqual([
      ['/organizations/naviwebsite/problems', 'POST'],
      ['/organizations/naviwebsite/problems/problem-id', 'PATCH'],
      ['/organizations/naviwebsite/problems/problem-id/status', 'PATCH'],
      ['/organizations/naviwebsite/problems/problem-id', undefined],
    ])
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(input)
  })

  it('encodes slug and PATCHes visibility', async () => {
    const { api, calls } = recorder()
    await updateOrganizationVisibility(api, 'a b', { problemsVisibility: 'PUBLIC' })
    expect(calls[0].path).toBe('/organizations/a%20b/visibility')
    expect(calls[0].init?.method).toBe('PATCH')
  })

  it('fetches one admin request by encoded id', async () => {
    const { api, calls } = recorder()
    await getAdminOrganizationRequest(api, 'request/id')
    expect(calls[0].path).toBe('/admin/organization-requests/request%2Fid')
  })

  it('uses the existing approve and reject endpoints with review payloads', async () => {
    const { api, calls } = recorder()
    await approveOrganizationRequest(api, 'request-id', {
      name: 'Khoa CNTT',
      slug: 'khoa-cntt',
      ownerIdentifier: 'owner-a',
      reviewNote: 'Đã kiểm tra',
    })
    await rejectOrganizationRequest(api, 'request-id', 'Thiếu thông tin')
    expect(calls.map(({ path, init }) => [path, init?.method, init?.body])).toEqual([
      [
        '/admin/organization-requests/request-id/approve',
        'POST',
        JSON.stringify({ name: 'Khoa CNTT', slug: 'khoa-cntt', ownerIdentifier: 'owner-a', reviewNote: 'Đã kiểm tra' }),
      ],
      [
        '/admin/organization-requests/request-id/reject',
        'POST',
        JSON.stringify({ reviewNote: 'Thiếu thông tin' }),
      ],
    ])
  })
})
