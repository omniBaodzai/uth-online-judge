import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInline, parseMarkdown, sanitizeHref } from '../src/lib/markdown.ts'
import { mapDiscussion, mapNews } from '../src/features/community/feed.ts'
import { formatDate, toDateBlock, totalPages } from '../src/features/community/format.ts'
import { validateNews } from '../src/features/community/validation.ts'
import { getBreadcrumbItems } from '../src/components/navigation/breadcrumb-routes.ts'

test('markdown only allows safe link protocols', () => {
  assert.equal(sanitizeHref('https://uth.edu.vn/a'), 'https://uth.edu.vn/a')
  assert.equal(sanitizeHref('mailto:a@b.vn'), 'mailto:a@b.vn')
  for (const bad of ['javascript:alert(1)', 'JaVaScript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.com', '/relative', '']) {
    assert.equal(sanitizeHref(bad), null, bad)
  }
})

test('markdown renders unsafe links as plain text and never emits html nodes', () => {
  const nodes = parseInline('[nhấn](javascript:alert(1)) và <script>alert(1)</script>')
  assert.ok(nodes.every((node) => node.type === 'text'))
  assert.equal(nodes.map((node) => (node.type === 'text' ? node.value : '')).join(''), 'nhấn và <script>alert(1)</script>')
})

test('markdown parses headings, lists, quotes, code and emphasis', () => {
  const blocks = parseMarkdown('# Tiêu đề\n\nĐoạn **đậm** và *nghiêng* `mã`\n\n- a\n- b\n\n1. x\n\n> trích\n\n```\n<b>raw</b>\n```')
  assert.deepEqual(blocks.map((block) => block.type), ['heading', 'paragraph', 'list', 'list', 'quote', 'code'])
  assert.equal(blocks[0].type === 'heading' && blocks[0].level, 2)
  assert.equal(blocks[3].type === 'list' && blocks[3].ordered, true)
  assert.equal(blocks[5].type === 'code' && blocks[5].value, '<b>raw</b>')
})

test('markdown keeps raw html and image syntax as text', () => {
  const [block] = parseMarkdown('<img src=x onerror=alert(1)> ![x](https://a.b/c.png)')
  assert.equal(block.type, 'paragraph')
  assert.ok(block.type === 'paragraph' && block.children.every((node) => node.type !== 'link' || node.href.startsWith('https://')))
})

test('feed mapping builds links, authors and counts', () => {
  const news = mapNews({ id: '1', slug: 'chao mung', title: 'T', summary: 'S', category: 'Thông báo', authorName: 'Admin', publishedAt: '2025-03-04T08:00:00Z' })
  assert.equal(news.to, '/news/chao%20mung')
  assert.equal(news.category, 'Thông báo')
  const discussion = mapDiscussion({ id: 'abc', title: 'T', summary: 'S', authorName: 'sv1', createdAt: '2025-03-04T08:00:00Z', replies: 3, isLocked: false })
  assert.equal(discussion.to, '/discussions/abc')
  assert.equal(discussion.replies, 3)
  assert.equal(discussion.category, undefined)
})

test('date helpers handle missing and invalid values', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate('không phải ngày'), '—')
  assert.deepEqual(toDateBlock(undefined), { day: '--', month: 'Th--' })
  assert.match(formatDate('2025-03-04T12:00:00Z'), /04\/03\/2025/)
  assert.equal(totalPages(0, 3), 1)
  assert.equal(totalPages(7, 3), 3)
})

test('news validation mirrors backend rules', () => {
  const valid = { title: 'Tin mới', slug: '', category: 'Thông báo', summary: 'Tóm tắt', content: 'Nội dung' }
  assert.deepEqual(validateNews(valid), {})
  const errors = validateNews({ ...valid, title: 'ab', slug: 'Sai Slug', summary: '', content: ' ' })
  assert.deepEqual(Object.keys(errors).sort(), ['content', 'slug', 'summary', 'title'])
})

test('community breadcrumbs resolve in the right order', () => {
  assert.deepEqual(getBreadcrumbItems('/news/ban-tin'), [
    { label: 'Trang chủ', to: '/' },
    { label: 'Tin tức', to: '/news' },
    { label: 'Chi tiết tin tức' },
  ])
  assert.equal(getBreadcrumbItems('/discussions/new').at(-1)?.label, 'Tạo chủ đề')
  assert.equal(getBreadcrumbItems('/discussions/123').at(-1)?.label, 'Chi tiết thảo luận')
  assert.equal(getBreadcrumbItems('/admin/news/new').at(-1)?.label, 'Tạo tin tức')
  assert.equal(getBreadcrumbItems('/admin/news').at(-1)?.label, 'Tin tức')
})
