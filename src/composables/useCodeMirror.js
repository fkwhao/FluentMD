import { ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { lightTheme } from '@/utils/lightTheme'
import { toggleBold, toggleItalic } from '@/utils/formatCommands'

const themeCompartment = new Compartment()
const readOnlyCompartment = new Compartment()

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
      if (update.docChanged && onUpdate) {
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

  function createEditor() {
    const el = elementRef()
    if (!el) return

    const state = EditorState.create({
      doc: pendingContent.value,
      extensions: [...createBaseExtensions(onUpdate, onSelectionChange), ...extensions],
    })

    editorView.value = new EditorView({
      state,
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
  }

  function destroyEditor() {
    if (editorView.value) {
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
    })
  }

  function getContent() {
    return editorView.value?.state.doc.toString() ?? ''
  }

  function setCursor(pos) {
    if (!editorView.value) return
    editorView.value.dispatch({
      selection: { anchor: pos },
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
