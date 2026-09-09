import test from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import * as viewModule from '@codemirror/view'
import { undo, redo, undoDepth } from '@codemirror/commands'
import { useEditorStore } from '../src/stores/editor.js'
import { loadSource } from './helpers/loadSource.js'

// Real Vue/Pinia lifecycle and real CodeMirror transactions/history, with
// only the DOM drawing surface replaced for Node's headless test environment.
class HeadlessView {
  constructor({ state, scrollTo }) {
    this.state = state
    this.scrollTo = scrollTo
    this.scrollDOM = { scrollTop: 0, scrollLeft: 0 }
    this.dispatch = (...specs) => {
      const transaction = specs[0]?.startState ? specs[0] : this.state.update(...specs)
      this.state = transaction.state
      for (const listener of this.state.facet(viewModule.EditorView.updateListener)) {
        listener({ view: this, state: this.state, docChanged: transaction.docChanged,
          selectionSet: !!transaction.selection, transactions: [transaction] })
      }
    }
  }
  setState(state) { this.state = state }
  focus() {}
  destroy() {}
  scrollSnapshot() { return this.scrollTo }
}
Object.setPrototypeOf(HeadlessView, viewModule.EditorView)

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
  insert() {}, remove() {}, patchProp() {},
})

test('the actual composable retains history across unmount/remount and isolates new documents', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const editor = useEditorStore()
  editor.setContent('lifecycle test')
  const { useCodeMirror } = await loadSource('src/composables/useCodeMirror.js', {
    '@codemirror/view': { ...viewModule, EditorView: HeadlessView },
  })
  async function mount() {
    let api
    const app = renderer.createApp({
      setup() {
        api = useCodeMirror(() => ({ addEventListener() {} }), {
          initialContent: editor.content,
          onUpdate: text => editor.updateContent(text),
        })
        return () => h('div')
      },
    })
    app.use(pinia)
    app.mount({})
    await nextTick()
    await nextTick()
    return { api, app }
  }
  const first = await mount()
  first.api.editorView.value.dispatch({ changes: { from: editor.content.length, insert: ' changed' } })
  assert.equal(editor.content, 'lifecycle test changed')
  first.app.unmount()
  const second = await mount()
  assert.equal(undoDepth(second.api.editorView.value.state), 1)
  assert.equal(undo(second.api.editorView.value), true)
  assert.equal(editor.content, 'lifecycle test')
  assert.equal(redo(second.api.editorView.value), true)
  assert.equal(editor.content, 'lifecycle test changed')
  editor.setContent('lifecycle test changed')
  await nextTick()
  assert.equal(undoDepth(second.api.editorView.value.state), 0)
  assert.equal(undo(second.api.editorView.value), false)
  second.app.unmount()
})
