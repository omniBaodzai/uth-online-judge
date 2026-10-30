import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInline, parseMarkdown, sanitizeHref } from '../src/lib/markdown.ts'

test('parses supported inline formatting without interpreting raw HTML', () => {
  const nodes = parseInline('**bold** *italic* ~~strike~~ ++underline++ <script>alert(1)</script>')

  assert.deepEqual(nodes.map((node) => node.type), [
    'strong',
    'text',
    'em',
    'text',
    'strike',
    'text',
    'underline',
    'text',
  ])
  assert.equal(nodes.at(-1)?.type, 'text')
})

test('parses headings, ordered and unordered lists, and fenced code blocks', () => {
  const blocks = parseMarkdown([
    '## Đề bài',
    '',
    '- **mục một**',
    '- mục hai',
    '',
    '1. bước một',
    '2. bước hai',
    '',
    '```cpp',
    'int answer = 42;',
    '```',
  ].join('\n'))

  assert.deepEqual(blocks.map((block) => block.type), ['heading', 'list', 'list', 'code'])
  assert.equal(blocks[1]?.type === 'list' && blocks[1].ordered, false)
  assert.equal(blocks[2]?.type === 'list' && blocks[2].ordered, true)
  assert.equal(blocks[3]?.type === 'code' && blocks[3].value, 'int answer = 42;')
})

test('rejects unsafe link protocols while retaining safe web links', () => {
  assert.equal(sanitizeHref('javascript:alert(1)'), null)
  assert.equal(sanitizeHref('data:text/html,<script>alert(1)</script>'), null)
  assert.equal(sanitizeHref('https://example.test/a'), 'https://example.test/a')
})
