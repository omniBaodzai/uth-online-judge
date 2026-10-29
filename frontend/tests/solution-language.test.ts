import assert from 'node:assert/strict'
import test from 'node:test'
import { monacoLanguageId } from '../src/features/problems/submit/languages.ts'

test('maps supported editorial languages to their Monaco syntax definitions', () => {
  assert.equal(monacoLanguageId('C++ (GCC 9.2.0)'), 'cpp')
  assert.equal(monacoLanguageId('C (GCC)'), 'cpp')
  assert.equal(monacoLanguageId('Java 21'), 'java')
  assert.equal(monacoLanguageId('JavaScript (Node.js)'), 'javascript')
  assert.equal(monacoLanguageId('Python 3'), 'python')
  assert.equal(monacoLanguageId('Go'), 'go')
  assert.equal(monacoLanguageId('Rust'), 'rust')
  assert.equal(monacoLanguageId('Kotlin'), 'kotlin')
  assert.equal(monacoLanguageId('Unknown language'), 'plaintext')
})
