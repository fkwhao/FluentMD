import test from 'node:test'
import assert from 'node:assert/strict'
import { EditorState, EditorSelection } from '@codemirror/state'
import { history, undoDepth, undo, redo } from '@codemirror/commands'
import { createEditorSession } from '../src/utils/editorSession.js'

test('initial mount without a cached session always creates a new editor', () => {
  const session = createEditorSession()
  assert.equal(session.restore(0, 'initial', [history()]).state.doc.toString(), 'initial')
  assert.equal(session.restore(undefined, 'initial', [history()]).state.doc.toString(), 'initial')
})

test('mode switches preserve undo, redo, selection and the scroll snapshot', () => {
  const session = createEditorSession()
  let state = EditorState.create({ doc: 'before', extensions: [history()] })
  state = state.update({ changes: { from: 6, insert: ' after' }, selection: EditorSelection.range(1, 4) }).state
  const scrollTo = { testSnapshot: true }
  session.capture(1, state, scrollTo)
  const restored = session.restore(1, 'before after', [history()])
  assert.equal(undoDepth(restored.state), 1)
  assert.equal(restored.state.selection.main.anchor, 1)
  assert.equal(restored.state.selection.main.head, 4)
  assert.equal(restored.scrollTo, scrollTo)
  const target = { state: restored.state, dispatch: transaction => { target.state = transaction.state } }
  assert.equal(undo(target), true)
  assert.equal(target.state.doc.toString(), 'before')
  assert.equal(redo(target), true)
  assert.equal(target.state.doc.toString(), 'before after')
})

test('a different document never inherits history even when text matches', () => {
  const session = createEditorSession()
  let state = EditorState.create({ doc: '', extensions: [history()] })
  state = state.update({ changes: { from: 0, insert: 'same text' } }).state
  session.capture(1, state)
  assert.equal(undoDepth(session.restore(2, 'same text', [history()]).state), 0)
})
