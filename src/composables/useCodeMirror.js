import { ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment, Annotation, Transaction } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { lightTheme } from '@/utils/lightTheme'
import { toggleBold, toggleItalic } from '@/utils/formatCommands'
import { editorSession } from '@/utils/editorSession'
import { useEditorStore } from '@/stores/editor'

const themeCompartment = new Compartment()
const readOnlyCompartment = new Compartment()
const externalContentUpdate = Annotation.define()

function createBaseExtensions(onUpdate, onSelectionChange) {
  const extensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    closeBrackets(),
    bracketMatching(),
    highlightSelectionMatches(),
    autocompletion(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
      { key: 'Mod-b', run: toggleBold },
      { key: 'Mod-i', run: toggleItalic },
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      const isExternalUpdate = update.transactions.some(
        (transaction) => transaction.annotation(externalContentUpdate)
      )
      if (update.docChanged && onUpdate && !isExternalUpdate) {
        onUpdate(update.state.doc.toString(), update)
      }
      if (update.selectionSet && onSelectionChange) {
        onSelectionChange(update)
      }
    }),
    themeCompartment.of(lightTheme),
    readOnlyCompartment.of(EditorState.readOnly.of(false)),
  ]

  return extensions
}

export function useCodeMirror(elementRef, options = {}) {
  const {
    initialContent = '',
    onUpdate,
    onSelectionChange,
    extensions = [],
  } = options

  const editorView = shallowRef(null)
  const isReady = ref(false)
  const pendingTheme = ref(null)
  const pendingContent = ref(initialContent)
  const editorStore = useEditorStore()
  let activeDocumentId = editorStore.documentId
  let disposed = false
  const allExtensions = () => [...createBaseExtensions(onUpdate, onSelectionChange), ...extensions]

  function createEditor() {
    const el = elementRef()
    if (!el || disposed) return

    activeDocumentId = editorStore.documentId
    const restored = editorSession.restore(activeDocumentId, pendingContent.value, allExtensions())

    editorView.value = new EditorView({
      ...restored,
      parent: el,
    })

    if (pendingTheme.value !== null) {
      editorView.value.dispatch({
        effects: themeCompartment.reconfigure(pendingTheme.value ? oneDark : lightTheme),
      })
    }

    // Disable native context menu on the editor element
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    isReady.value = true
    editorView.value.focus()
  }

  function destroyEditor() {
    if (editorView.value) {
      editorSession.capture(activeDocumentId, editorView.value.state, editorView.value.scrollSnapshot())
      editorView.value.destroy()
      editorView.value = null
      isReady.value = false
    }
  }

  function setContent(text) {
    pendingContent.value = text
    if (!editorView.value) return
    const current = editorView.value.state.doc.toString()
    if (current === text) return
    editorView.value.dispatch({
      changes: { from: 0, to: current.length, insert: text },
      selection: { anchor: 0 },
      annotations: [
        externalContentUpdate.of(true),
        Transaction.addToHistory.of(false),
      ],
    })
  }

  // Opening/new document is a session boundary even if its text is identical.
  // Mode switches retain history; switching documents must never retain it.
  watch(() => editorStore.documentId, () => {
    activeDocumentId = editorStore.documentId
    pendingContent.value = editorStore.content
    if (!editorView.value) return
    editorView.value.setState(EditorState.create({ doc: editorStore.content, extensions: allExtensions() }))
    if (pendingTheme.value !== null) setTheme(pendingTheme.value)
    editorView.value.scrollDOM.scrollTop = 0
    editorView.value.scrollDOM.scrollLeft = 0
  })

  function getContent() {
    return editorView.value?.state.doc.toString() ?? ''
  }

  function setCursor(pos) {
    if (!editorView.value) return
    const safePos = Math.max(0, Math.min(pos, editorView.value.state.doc.length))
    editorView.value.dispatch({
      selection: { anchor: safePos },
      effects: EditorView.scrollIntoView(safePos, { y: 'center' }),
    })
    editorView.value.focus()
  }

  function focus() {
    editorView.value?.focus()
  }

  function setTheme(isDark) {
    pendingTheme.value = isDark
    if (!editorView.value) return
    editorView.value.dispatch({
      effects: themeCompartment.reconfigure(isDark ? oneDark : lightTheme),
    })
  }

  onMounted(async () => {
    await nextTick()
    if (disposed) return
    createEditor()
    if (!isReady.value) {
      const unwatch = watch(() => elementRef(), (el) => {
        if (el && !isReady.value) {
          createEditor()
          unwatch()
        }
      })
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    destroyEditor()
  })

  return {
    editorView,
    isReady,
    setContent,
    getContent,
    setCursor,
    focus,
    setTheme,
    themeCompartment,
  }
}
