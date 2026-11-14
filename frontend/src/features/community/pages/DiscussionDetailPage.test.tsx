// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscussionComment, DiscussionDetail, PageResult } from '../api'
import styles from '../community.module.css'
import DiscussionDetailPage from './DiscussionDetailPage'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  showToast: vi.fn(),
  translate: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.translate, i18n: { language: 'en', resolvedLanguage: 'en' } }),
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    useCommunityRequest: () => ({
      request: mocks.request,
      isReady: true,
      isAuthenticated: false,
    }),
  }
})

vi.mock('../../../components/ui/toast-context', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

function comment(id: string, replies: DiscussionComment[] = []): DiscussionComment {
  return {
    id,
    discussionId: 'discussion-1',
    parentId: null,
    isDeleted: false,
    authorName: 'Member',
    content: `Comment ${id}`,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    reactions: { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null },
    replies,
    canEdit: false,
    canDelete: false,
  }
}

const discussion: DiscussionDetail = {
  id: 'discussion-1',
  title: 'Test discussion',
  authorName: 'Member',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  replies: 21,
  isLocked: false,
  content: 'Discussion content',
  reactions: { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null },
  canEdit: false,
  canDelete: false,
  canModerate: false,
}

let root: Root
let container: HTMLDivElement
let scrollIntoView: ReturnType<typeof vi.fn>
let lookupRoots: DiscussionComment[]

beforeEach(() => {
  vi.clearAllMocks()
  lookupRoots = Array.from({ length: 20 }, (_, index) => comment(`root-${index + 1}`))
  lookupRoots.push(comment('root-21', [comment('reply-1', [comment('target-reply')])]))
  mocks.request.mockImplementation(async (path: string) => {
    if (path === '/discussions/discussion-1') return discussion
    const [pathname, query = ''] = path.split('?')
    if (pathname !== '/discussions/discussion-1/comments') {
      throw new Error(`Unexpected request: ${path}`)
    }

    const params = new URLSearchParams(query)
    const page = Number(params.get('page'))
    const pageSize = Number(params.get('pageSize'))
    const items = pageSize === 50
      ? lookupRoots
      : lookupRoots.slice((page - 1) * pageSize, page * pageSize)
    return {
      items,
      total: lookupRoots.length,
      page,
      pageSize,
    } satisfies PageResult<DiscussionComment>
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
  scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('DiscussionDetailPage notification deep links', () => {
  it('loads the correct page for a nested reply on refresh and scrolls to the target', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/discussions/discussion-1?commentId=target-reply&rootCommentId=root-21']}>
          <Routes>
            <Route path="/discussions/:id" element={<DiscussionDetailPage />} />
          </Routes>
        </MemoryRouter>,
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })

    const target = container.querySelector('#discussion-comment-target-reply')
    expect(target).not.toBeNull()
    expect(target?.textContent).toContain('Comment target-reply')
    expect(target?.getAttribute('tabindex')).toBe('-1')
    expect(target?.classList.contains(styles.commentTargetHighlight)).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(mocks.request.mock.calls.some(([path]) =>
      path === '/discussions/discussion-1/comments?page=2&pageSize=20',
    )).toBe(true)
  })

  it('shows a friendly message when the target is no longer available', async () => {
    lookupRoots = [comment('different-root')]
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/discussions/discussion-1?commentId=deleted-comment&rootCommentId=deleted-root']}>
          <Routes>
            <Route path="/discussions/:id" element={<DiscussionDetailPage />} />
          </Routes>
        </MemoryRouter>,
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(container.textContent).toContain('This comment is no longer available in this discussion.')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
