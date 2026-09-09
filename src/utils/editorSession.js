import { EditorState, StateEffect } from '@codemirror/state'

export function createEditorSession() {
  let saved = null
  return {
    capture(documentId, state, scrollTo) {
      saved = { documentId, state, scrollTo }
    },
    restore(documentId, doc, extensions) {
      const previous = saved
      saved = null
      if (previous && previous.documentId === documentId && previous.state.doc.toString() === doc) {
        return {
          state: previous.state.update({ effects: StateEffect.reconfigure.of(extensions) }).state,
          scrollTo: previous.scrollTo,
        }
      }
      return { state: EditorState.create({ doc, extensions }) }
    },
  }
}

export const editorSession = createEditorSession()
