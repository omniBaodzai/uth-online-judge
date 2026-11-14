import { describe, expect, it, vi } from 'vitest'
import { createContestApi } from './contest-api'
import type { AdminProblemPage } from '../types'

describe('contest problem picker API', () => {
  it('keeps published hidden problems in the admin picker response', async () => {
    const page: AdminProblemPage = {
      items: [{
        id: 'hidden-problem',
        code: 'HIDDEN_01',
        title: 'Hidden problem',
        summary: null,
        illustrationUrl: null,
        illustrationWidth: 100,
        illustrationAspectRatio: 'auto',
        illustrationAlignment: 'center',
        statement: 'Statement',
        difficulty: 'easy',
        tags: [],
        languages: [],
        inputDescription: '',
        outputDescription: '',
        constraints: '',
        timeLimitSeconds: 1,
        memoryLimitMb: 128,
        scoringEnabled: false,
        score: 100,
        testCaseRevision: 0,
        examples: [],
        editorials: [],
        status: 'published',
        isHidden: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      total: 1,
      page: 1,
      pageSize: 100,
    }
    const request = vi.fn().mockResolvedValue(page)

    await expect(createContestApi(request).listProblems('')).resolves.toBe(page)
    expect(request).toHaveBeenCalledWith('/admin/problems?page=1&pageSize=100&status=published')
  })
})
