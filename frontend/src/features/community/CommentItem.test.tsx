// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentItem, type CommentNode } from './CommentItem'
import { CommentText } from './CommentText'
import { useCommentReply } from './useCommentReply'
import { resolveAvatarUrl } from '../auth/api'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) => {
      let value = typeof options?.defaultValue === 'string' ? options.defaultValue : _key
      for (const [name, replacement] of Object.entries(options ?? {})) {
        if (name !== 'defaultValue') value = value.replaceAll(`{{${name}}}`, String(replacement))
      }
      return value
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('./api', () => ({
  useCommunityRequest: () => ({
    request: mocks.request,
    isReady: true,
    isAuthenticated: true,
  }),
}))

vi.mock('../../components/ui/toast-context', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('./ReactionBar', () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}))

function comment(id: string, authorUsername: string | null, replies: CommentNode[] = [], avatarUrl: string | null = null, content = `Comment by ${authorUsername}`): CommentNode {
  return {
    id,
    parentId: null,
    isDeleted: false,
    authorName: authorUsername ?? 'Người dùng đã xóa',
    authorUsername,
    avatarUrl,
    content,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    reactions: { counts: { LIKE: 0, LOVE: 0, HELPFUL: 0 }, mine: null },
    replies,
    canEdit: false,
    canDelete: false,
  }
}

function CommentHarness({ comments, targetCommentId = null, highlightedCommentId = null }: { comments: CommentNode[]; targetCommentId?: string | null; highlightedCommentId?: string | null }) {
  const replyController = useCommentReply()
  return (
    <MemoryRouter>
      {comments.map((item) => (
        <CommentItem
          key={item.id}
          comment={item}
          paths={{
            create: '/comments',
            item: (id) => `/comments/${id}`,
            reaction: (id) => `/comments/${id}/reaction`,
            supportsIdempotencyKey: true,
          }}
          targetCommentId={targetCommentId}
          highlightedCommentId={highlightedCommentId}
          replyController={replyController}
          request={mocks.request}
          onChanged={vi.fn()}
        />
      ))}
    </MemoryRouter>
  )
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.request.mockResolvedValue(undefined)
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(comments: CommentNode[]) {
  await act(async () => root.render(<CommentHarness comments={comments} />))
}

function replyToggle(commentId: string) {
  return container.querySelector<HTMLButtonElement>(`#comment-${commentId} button[aria-expanded]`)
}

async function clickReplyToggle(commentId: string) {
  const button = replyToggle(commentId)
  expect(button).not.toBeNull()
  await act(async () => button?.click())
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

async function clickReplyFor(username: string) {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
  const button = buttons.find((item) => item.textContent?.trim() === 'Reply' && item.parentElement?.parentElement?.querySelector('strong')?.textContent === username)
  expect(button).not.toBeNull()
  await act(async () => button?.click())
}

describe('CommentItem reply mentions', () => {
  it('does not render a reply toggle when there are no direct replies', async () => {
    await render([comment('lonely', 'solo_user')])

    expect(container.querySelector('#comment-lonely button[aria-expanded]')).toBeNull()
  })

  it('starts collapsed, counts only direct replies, and toggles nested branches independently', async () => {
    await render([comment('root', 'root_user', [comment('first', 'first_user', [comment('grandchild', 'grandchild_user')]), comment('second', 'second_user')])])

    expect(replyToggle('root')?.textContent).toBe('Show 2 replies')
    expect(replyToggle('root')?.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('comment-first')?.hidden).toBe(true)
    expect(document.getElementById('comment-grandchild')?.hidden).toBe(true)
    expect(replyToggle('root')?.getAttribute('aria-controls')).toBe('comment-first comment-second')

    await clickReplyToggle('root')
    expect(replyToggle('root')?.textContent).toBe('Hide 2 replies')
    expect(document.getElementById('comment-first')?.hidden).toBe(false)
    expect(document.getElementById('comment-second')?.hidden).toBe(false)
    expect(document.getElementById('comment-grandchild')?.hidden).toBe(true)
    expect(replyToggle('first')?.textContent).toBe('Show 1 reply')

    await clickReplyToggle('first')
    expect(document.getElementById('comment-grandchild')?.hidden).toBe(false)
    await clickReplyToggle('root')
    expect(document.getElementById('comment-first')?.hidden).toBe(true)

    await clickReplyToggle('root')
    expect(document.getElementById('comment-grandchild')?.hidden).toBe(false)
  })

  it.each([0, 1, 2, 3, 5, 10, 20])('keeps the visual indent capped at depth %i while preserving every reply', async (maxDepth) => {
    let deepest = comment(`depth-${maxDepth}`, `user${maxDepth}`)
    for (let depth = maxDepth - 1; depth >= 0; depth -= 1) {
      deepest = comment(`depth-${depth}`, `user${depth}`, [deepest])
    }
    await render([deepest])

    for (let depth = 0; depth < maxDepth; depth += 1) {
      const toggle = replyToggle(`depth-${depth}`)
      expect(toggle).not.toBeNull()
      await act(async () => toggle?.click())
    }

    for (let depth = 0; depth <= maxDepth; depth += 1) {
      const row = document.getElementById(`comment-depth-${depth}`)
      expect(row).not.toBeNull()
      expect(row?.hidden).toBe(false)
      if (depth > 0) {
        expect(row?.style.getPropertyValue('--reply-indent')).toBe(`${Math.min(depth, 3) * 16}px`)
      }
      if (depth > 3) {
        expect(row?.textContent).toContain(`Replying to @user${depth - 1}`)
      }
    }
  })

  it('opens ancestors of a deep-linked highlighted comment', async () => {
    const tree = comment('root', 'root_user', [comment('reply', 'reply_user', [comment('target', 'target_user')])])
    await act(async () => root.render(<CommentHarness comments={[tree]} targetCommentId="root" highlightedCommentId="target" />))

    expect(document.getElementById('comment-reply')?.hidden).toBe(false)
    expect(document.getElementById('comment-target')?.hidden).toBe(false)
    expect(document.getElementById('comment-target')?.className).toContain('commentTargetHighlight')
  })

  it('prefills the exact username and focuses the caret after the prefix', async () => {
    await render([comment('a', 'buiducdunges')])
    await clickReplyFor('buiducdunges')

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')
    expect(textarea?.value).toBe('@buiducdunges ')
    expect(document.activeElement).toBe(textarea)
    expect(textarea?.selectionStart).toBe('@buiducdunges '.length)
  })

  it('switches reply targets without losing either draft or attaching text to the wrong parent', async () => {
    await render([comment('comment-a', 'account_a'), comment('comment-b', 'account-b')])
    await clickReplyFor('account_a')
    const firstDraft = container.querySelector<HTMLTextAreaElement>('textarea')
    expect(firstDraft?.value).toBe('@account_a ')
    if (!firstDraft) throw new Error('Reply textarea was not rendered.')
    await act(async () => setTextareaValue(firstDraft, '@account_a first draft'))

    await clickReplyFor('account-b')
    const secondDraft = container.querySelector<HTMLTextAreaElement>('textarea')
    expect(secondDraft?.value).toBe('@account-b ')
    if (!secondDraft) throw new Error('Second reply textarea was not rendered.')
    await act(async () => setTextareaValue(secondDraft, '@account-b second draft'))

    await clickReplyFor('account_a')
    const restoredDraft = container.querySelector<HTMLTextAreaElement>('textarea')
    expect(restoredDraft?.value).toBe('@account_a first draft')
    if (!restoredDraft) throw new Error('Restored reply textarea was not rendered.')

    await act(async () => {
      const form = restoredDraft.closest('form')
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(mocks.request).toHaveBeenCalledWith(
      '/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '@account_a first draft',
          parentId: 'comment-a',
        }),
      }),
    )
  })

  it('preserves a reply draft when its branch is hidden and shown again', async () => {
    await render([comment('root', 'root_user', [comment('reply', 'reply_user')])])
    await clickReplyToggle('root')
    await clickReplyFor('reply_user')

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')
    expect(textarea?.value).toBe('@reply_user ')
    if (!textarea) throw new Error('Reply textarea was not rendered.')
    await act(async () => setTextareaValue(textarea, '@reply_user retained draft'))

    await clickReplyToggle('root')
    expect(document.getElementById('comment-reply')?.hidden).toBe(true)
    expect(textarea.value).toBe('@reply_user retained draft')
    await clickReplyToggle('root')
    expect(document.getElementById('comment-reply')?.hidden).toBe(false)
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('@reply_user retained draft')
  })

  it('preserves an edit draft when its branch is hidden and shown again', async () => {
    const reply = comment('reply', 'reply_user')
    reply.canEdit = true
    await render([comment('root', 'root_user', [reply])])
    await clickReplyToggle('root')

    const edit = [...container.querySelectorAll<HTMLButtonElement>('#comment-reply button')].find((button) => button.textContent === 'Edit')
    await act(async () => edit?.click())
    const editTextarea = container.querySelector<HTMLTextAreaElement>('#comment-reply textarea[aria-label="Edit comment"]')
    if (!editTextarea) throw new Error('Edit textarea was not rendered.')
    await act(async () => setTextareaValue(editTextarea, 'unsaved edit draft'))

    await clickReplyToggle('root')
    expect(document.getElementById('comment-reply')?.hidden).toBe(true)
    expect(editTextarea.value).toBe('unsaved edit draft')
    await clickReplyToggle('root')
    expect(document.getElementById('comment-reply')?.hidden).toBe(false)
    expect(container.querySelector<HTMLTextAreaElement>('#comment-reply textarea[aria-label="Edit comment"]')?.value).toBe('unsaved edit draft')
  })

  it('posts a reply to the selected nested parent rather than its root', async () => {
    await render([comment('root', 'root_user', [comment('reply', 'reply_user')])])
    await clickReplyToggle('root')
    await clickReplyFor('reply_user')
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')
    if (!textarea) throw new Error('Reply textarea was not rendered.')
    await act(async () => setTextareaValue(textarea, '@reply_user nested response'))

    await act(async () => {
      textarea.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(mocks.request).toHaveBeenCalledWith(
      '/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '@reply_user nested response',
          parentId: 'reply',
        }),
      }),
    )
  })

  it('retains edit and delete controls on flattened reply rows', async () => {
    const reply = comment('reply', 'reply_user')
    reply.canEdit = true
    reply.canDelete = true
    await render([comment('root', 'root_user', [reply])])
    await clickReplyToggle('root')

    const row = document.getElementById('comment-reply')
    expect(row?.querySelector('[data-testid="reaction-bar"]')).not.toBeNull()
    const edit = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((button) => button.textContent === 'Edit')
    expect(edit).not.toBeUndefined()
    await act(async () => edit?.click())
    const editTextarea = row?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit comment"]')
    expect(editTextarea).not.toBeNull()
    if (!editTextarea) throw new Error('Edit textarea was not rendered.')
    await act(async () => setTextareaValue(editTextarea, 'updated reply'))
    await act(async () => {
      editTextarea.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(mocks.request).toHaveBeenCalledWith(
      '/comments/reply',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'updated reply' }),
      }),
    )

    const originalConfirm = Object.getOwnPropertyDescriptor(window, 'confirm')
    const confirm = vi.fn(() => true)
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm })
    try {
      const remove = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((button) => button.textContent === 'Delete')
      await act(async () => remove?.click())
      expect(confirm).toHaveBeenCalledOnce()
      expect(mocks.request).toHaveBeenCalledWith('/comments/reply', {
        method: 'DELETE',
      })
    } finally {
      if (originalConfirm) Object.defineProperty(window, 'confirm', originalConfirm)
      else Reflect.deleteProperty(window, 'confirm')
    }
  })

  it('renders a nested author avatar at each depth and uses fallback when an image fails', async () => {
    await render([comment('root', 'root_user', [comment('reply', 'reply_user', [comment('nested', 'nested_user')], '/avatar.webp')])])

    const avatars = container.querySelectorAll('[aria-hidden="true"]')
    expect(avatars).toHaveLength(3)
    const image = container.querySelector<HTMLImageElement>('img')
    expect(image).not.toBeNull()
    expect(image?.src).toBe(resolveAvatarUrl('/avatar.webp'))
    expect(container.querySelector<HTMLAnchorElement>('a[href="/users/nested_user"]')).not.toBeNull()
    const avatar = image?.parentElement
    await act(async () => image?.dispatchEvent(new Event('error')))
    expect(avatar?.textContent).toBe('R')
  })

  it('links each valid author avatar and username to their own public profile', async () => {
    await render([comment('author-a', 'account_a', [], '/uploads/a.webp'), comment('author-b', 'account-b', [], '/uploads/b.webp')])

    expect([...container.querySelectorAll<HTMLAnchorElement>('a[aria-label]')].map((link) => link.getAttribute('href'))).toEqual(['/users/account_a', '/users/account-b'])
    expect([...container.querySelectorAll<HTMLAnchorElement>('strong a')].map((link) => link.getAttribute('href'))).toEqual(['/users/account_a', '/users/account-b'])
    expect([...container.querySelectorAll<HTMLImageElement>('img')].map((image) => image.src)).toEqual([resolveAvatarUrl('/uploads/a.webp'), resolveAvatarUrl('/uploads/b.webp')])
    expect(container.querySelector<HTMLAnchorElement>('a[aria-label]')?.getAttribute('aria-label')).toContain('account_a')
  })

  it('links a reply mention only to its actual parent author', async () => {
    await render([comment('root', 'parent_user', [comment('reply', 'reply_user', [], null, '@parent_user thanks, @unverified_user')])])

    const mentions = [...container.querySelectorAll<HTMLAnchorElement>('a[href="/users/parent_user"]')].filter((link) => link.textContent === '@parent_user')
    expect(mentions).toHaveLength(1)
    expect(mentions[0]?.textContent).toBe('@parent_user')
    expect(mentions[0]?.getAttribute('href')).toBe('/users/parent_user')
    expect(container.textContent).toContain('@unverified_user')
    expect(container.querySelector('a[href="/users/unverified_user"]')).toBeNull()
  })

  it('does not make an invalid author name navigable', async () => {
    await render([comment('missing-user', 'Người dùng đã xóa', [], '/avatar.webp')])

    expect(container.querySelectorAll('a[aria-label]')).toHaveLength(0)
    expect(container.querySelectorAll('strong a')).toHaveLength(0)
  })

  it('does not invent a mention when a reply target has no valid username', async () => {
    await render([comment('missing-username', null)])
    await clickReplyFor('Người dùng đã xóa')

    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('')
  })

  it('shows only verified parent usernames on deep replies and preserves long text', async () => {
    const longUsername = 'u'.repeat(32)
    const longContent = 'A long comment that must remain readable. '.repeat(20)
    const tree = comment('root', 'root_user', [comment('depth-1', 'user_one', [comment('depth-2', 'user_two', [comment('depth-3', longUsername, [comment('depth-4', 'deep_user', [], null, longContent)])])])])
    await render([tree])

    for (const id of ['root', 'depth-1', 'depth-2', 'depth-3']) {
      await clickReplyToggle(id)
    }

    const deepReply = document.getElementById('comment-depth-4')
    expect(deepReply?.textContent).toContain(`Replying to @${longUsername}`)
    expect(deepReply?.textContent).toContain(longContent)

    const invalidParentTree = comment('invalid-root', 'root_user', [
      comment('invalid-depth-1', 'user_one', [comment('invalid-depth-2', 'user_two', [comment('invalid-depth-3', 'not a username', [comment('invalid-depth-4', 'deep_user')])])]),
    ])
    await act(async () => root.render(<CommentHarness comments={[invalidParentTree]} />))
    for (const id of ['invalid-root', 'invalid-depth-1', 'invalid-depth-2', 'invalid-depth-3']) {
      await clickReplyToggle(id)
    }
    expect(document.getElementById('comment-invalid-depth-4')?.textContent).not.toContain('Replying to @')
  })
})

describe('CommentText', () => {
  it('highlights mention tokens safely while preserving special characters and line breaks', async () => {
    const content = '@account-1 <img src=x onerror=alert(1)>\nReply @second_user & <tag>'
    await act(async () =>
      root.render(
        <MemoryRouter>
          <CommentText content={content} replyToUsername="account-1" />
        </MemoryRouter>,
      ),
    )

    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(container.querySelectorAll('a[href="/users/account-1"]')).toHaveLength(1)
    expect(container.querySelectorAll('span')).toHaveLength(1)
    expect(container.textContent).toBe(content)
    expect(container.querySelector('p')?.textContent).toContain('\n')
  })

  it('keeps mentions as text when no matching public profile is known', async () => {
    const content = 'Email user@example.com or write @not_verified_user.'
    await act(async () =>
      root.render(
        <MemoryRouter>
          <CommentText content={content} />
        </MemoryRouter>,
      ),
    )

    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.textContent).toBe(content)
  })
})
