// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommentNode } from '../../community/CommentItem'
import ProblemComments from './ProblemComments'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-id' },
    request: mocks.request,
    accessToken: 'test-token',
    isLoading: false,
  }),
}))

vi.mock('../../../components/ui/toast-context', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('../../community/CommentItem', () => ({
  CommentItem: ({
    comment,
    targetCommentId,
    targetElementId,
    highlightedCommentId,
  }: {
    comment: CommentNode
    targetCommentId?: string | null
    targetElementId?: string | null
    highlightedCommentId?: string | null
  }) => {
    function renderNode(node: CommentNode): ReactNode {
      return (
        <div
          key={node.id}
          id={node.id === targetCommentId ? targetElementId ?? undefined : undefined}
          data-testid={`comment-${node.id}`}
          data-highlighted={node.id === highlightedCommentId}
          tabIndex={node.id === targetCommentId ? -1 : undefined}
        >
          {node.replies.map(renderNode)}
        </div>
      )
    }
    return renderNode(comment)
  },
}))

vi.mock('../../../components/ui/Pagination', () => ({ default: () => null }))

function comment(id: string, replies: CommentNode[] = []): CommentNode {
  return {
    id,
    parentId: null,
    isDeleted: false,
    authorName: 'user',
    content: 'comment',
    createdAt: '',
    updatedAt: '',
    reactions: { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null },
    replies,
    canEdit: false,
    canDelete: false,
  }
}

const roots = Array.from({ length: 50 }, (_, index) => comment(`root-${index + 1}`))
roots[21] = comment('root-22', [comment('reply-1', [comment('target-reply')])])

function response(page: number, pageSize: number) {
  return {
    items: roots.slice((page - 1) * pageSize, page * pageSize),
    total: roots.length,
    page,
    pageSize,
  }
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.request.mockImplementation(async (path: string) => {
    const [endpoint, query = ''] = path.split('?')
    if (endpoint !== '/problems/khobau/comments') throw new Error(`Unexpected request: ${path}`)
    const params = new URLSearchParams(query)
    const page = Number(params.get('page') ?? 1)
    const pageSize = Number(params.get('pageSize') ?? 10)
    return response(page, pageSize)
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
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

describe('ProblemComments notification deep links', () => {
  it('loads the display page, scrolls to a nested reply, focuses and briefly highlights it', async () => {
    const scrollIntoView = vi.fn()
    const focus = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'focus', { configurable: true, value: focus })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/problems/khobau?commentId=target-reply&rootCommentId=root-22']}>
          <Routes>
            <Route
              path="/problems/:code"
              element={<ProblemCommentsWithCode />}
            />
          </Routes>
        </MemoryRouter>,
      )
      for (let index = 0; index < 8; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))

    const target = container.querySelector<HTMLElement>('#problem-comment-target-reply')
    expect(target).not.toBeNull()
    expect(target?.getAttribute('data-highlighted')).toBe('true')
    expect(mocks.request.mock.calls.some(([path]) =>
      path === '/problems/khobau/comments?page=3&pageSize=10',
    )).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})

function ProblemCommentsWithCode() {
  return <ProblemComments code="khobau" />
}
