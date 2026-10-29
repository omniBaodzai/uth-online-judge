import assert from 'node:assert/strict'
import test from 'node:test'
import { areMonacoEditorRenderPropsEqual } from '../src/features/problems/submit/monaco-editor-render.ts'

test('skips Monaco renders when only the editor value changes', () => {
  const onChange = () => undefined
  const onReady = () => undefined
  const previous = { language: 'cpp', revision: 0, onChange, onReady, value: 'before' }
  const next = { ...previous, value: 'after' }

  assert.equal(areMonacoEditorRenderPropsEqual(previous, next), true)
})

test('rerenders Monaco for a language change, explicit reset, or handler change', () => {
  const onChange = () => undefined
  const onReady = () => undefined
  const props = { language: 'cpp', revision: 0, onChange, onReady }

  assert.equal(areMonacoEditorRenderPropsEqual(props, { ...props, language: 'java' }), false)
  assert.equal(areMonacoEditorRenderPropsEqual(props, { ...props, revision: 1 }), false)
  assert.equal(areMonacoEditorRenderPropsEqual(props, { ...props, onChange: () => undefined }), false)
})