import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyImportedTestCases,
  parseTestCaseFiles,
  type ImportedTestCase,
} from '../src/features/admin/test-case-import.ts'
import type { AdminTestCaseDraft } from '../src/features/admin/types.ts'

function file(name: string, contents: string | Uint8Array): File {
  return new File([contents], name)
}

test('pairs and naturally sorts twenty numbered file pairs by exact stem', async () => {
  const files: File[] = []
  for (let number = 20; number >= 1; number -= 1) {
    const stem = String(number).padStart(2, '0')
    files.push(file(`${stem}.out`, `out-${stem}`), file(`${stem}.in`, `in-${stem}`))
  }

  const result = await parseTestCaseFiles(files)
  assert.deepEqual(result.errors, [])
  assert.equal(result.cases.length, 20)
  assert.deepEqual(result.cases.map(({ stem }) => stem), Array.from(
    { length: 20 },
    (_, index) => String(index + 1).padStart(2, '0'),
  ))
  assert.equal(result.cases[0]?.input, 'in-01')
  assert.equal(result.cases[0]?.expectedOutput, 'out-01')
})

test('reports missing sides and does not pair stems that differ', async () => {
  const result = await parseTestCaseFiles([
    file('01.in', 'input'),
    file('2.out', 'output'),
    file('test01.in', 'different stem'),
    file('test1.out', 'different stem'),
  ])

  assert.deepEqual(result.cases, [])
  assert.deepEqual(result.errors.map(({ fileName }) => fileName), [
    '01.out',
    '2.in',
    'test1.in',
    'test01.out',
  ])
})

test('reports unsupported, duplicate, and conflicting filenames', async () => {
  const result = await parseTestCaseFiles([
    file('notes.txt', 'unsupported'),
    file('01.in', 'first'),
    file('01.IN', 'duplicate'),
    file('01.out', 'output'),
  ])

  assert.deepEqual(result.errors.map(({ fileName }) => fileName), ['01.IN', 'notes.txt'])
  assert.match(result.errors[0]?.message ?? '', /trùng|xung đột/)
  assert.match(result.errors[1]?.message ?? '', /chỉ chấp nhận/i)
})

test('rejects empty contents and invalid UTF-8 instead of silently replacing bytes', async () => {
  const result = await parseTestCaseFiles([
    file('empty.in', ''),
    file('empty.out', 'valid'),
    file('bad.in', new Uint8Array([0xc3, 0x28])),
    file('bad.out', 'valid'),
  ])

  assert.deepEqual(result.cases, [])
  assert.equal(result.errors.length, 2)
  assert.ok(result.errors.some(({ message }) => message.includes('không được để trống')))
  assert.ok(result.errors.some(({ message }) => message.includes('UTF-8 hợp lệ')))
})

test('preserves Unicode, whitespace, line breaks, and UTF-8 byte order marks', async () => {
  const result = await parseTestCaseFiles([
    file('unicode.in', '\uFEFF  Xin chào\r\n'),
    file('unicode.out', '  Kết quả ✅\n\n'),
  ])

  assert.deepEqual(result.errors, [])
  assert.equal(result.cases[0]?.input, '\uFEFF  Xin chào\r\n')
  assert.equal(result.cases[0]?.expectedOutput, '  Kết quả ✅\n\n')
})

test('enforces configurable per-file, aggregate-size, and file-count limits', async () => {
  const pair = [file('a.in', '1234'), file('a.out', '5678')]
  const perFile = await parseTestCaseFiles(pair, { maxFiles: 4, maxFileBytes: 3, maxTotalBytes: 100 })
  assert.equal(perFile.errors.length, 2)

  const aggregate = await parseTestCaseFiles(pair, { maxFiles: 4, maxFileBytes: 100, maxTotalBytes: 7 })
  assert.match(aggregate.errors[0]?.message ?? '', /Tổng dung lượng/)

  const count = await parseTestCaseFiles(pair, { maxFiles: 1, maxFileBytes: 100, maxTotalBytes: 100 })
  assert.match(count.errors[0]?.message ?? '', /tối đa 1 tệp/)
})

test('append and replace produce deterministic hidden editable drafts', () => {
  const current: AdminTestCaseDraft[] = [{
    id: 'persisted',
    clientId: 'persisted',
    name: 'Đang có',
    input: 'old',
    expectedOutput: 'old',
    kind: 'sample',
  }]
  const imported: ImportedTestCase[] = [
    { stem: '01', input: '1', expectedOutput: '2' },
    { stem: '02', input: '3', expectedOutput: '4' },
  ]
  let nextId = 0
  const createId = () => `new-${++nextId}`

  const appended = applyImportedTestCases(current, imported, 'append', createId)
  assert.equal(appended.length, 3)
  assert.equal(appended[0]?.id, 'persisted')
  assert.deepEqual(appended.slice(1).map(({ kind, clientId }) => [kind, clientId]), [
    ['hidden', 'new-1'],
    ['hidden', 'new-2'],
  ])

  const replaced = applyImportedTestCases(current, imported, 'replace', createId)
  assert.equal(replaced.length, 2)
  assert.ok(replaced.every(({ kind }) => kind === 'hidden'))
  assert.deepEqual(replaced.map(({ name }) => name), ['01', '02'])
})
