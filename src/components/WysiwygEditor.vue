<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useCodeMirror } from '@/composables/useCodeMirror'
import { useEditorStore } from '@/stores/editor'
import { useFileStore } from '@/stores/file'
import { useSettingsStore } from '@/stores/settings'
import { createWysiwygPlugin, wysiwygTheme } from '@/utils/wysiwygDecorations'
import { syntaxTree } from '@codemirror/language'
import ContextMenu from '@/components/ContextMenu.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import LanguageSelector from '@/components/LanguageSelector.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const editorStore = useEditorStore()
const fileStore = useFileStore()
const settingsStore = useSettingsStore()
const editorEl = ref(null)
const editorStateVersion = ref(0)

const contextMenu = ref({ visible: false, x: 0, y: 0 })
const selectionToolbar = ref({ visible: false, x: 0, y: 0 })
const langSelector = ref({ visible: false, x: 0, y: 0, from: 0, to: 0, currentLang: '' })
const wysiwygPlugin = createWysiwygPlugin(() => fileStore.filePath || '')

function handleContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY }
}

function handleSelectionChange(update) {
  const sel = update.state.selection.main
  editorStateVersion.value += 1
  if (sel.from !== sel.to && sel.length > 0) {
    const view = update.view
    const coords = view.coordsAtPos(sel.from)
    if (coords) {
      selectionToolbar.value = {
        visible: true,
        x: (coords.left + coords.right) / 2,
        y: coords.top - 8,
      }
    }
  } else {
    selectionToolbar.value.visible = false
  }
}

const { editorView, setContent, setTheme, focus } = useCodeMirror(
  () => editorEl.value,
  {
    initialContent: props.modelValue,
    extensions: [wysiwygPlugin, wysiwygTheme],
    onSelectionChange: handleSelectionChange,
    onUpdate(text) {
      editorStateVersion.value += 1
      editorStore.updateContent(text)
      emit('update:modelValue', text)
    },
  }
)

function handleClick(event) {
  const target = event.target
  const langEl = target.closest?.('[data-code-lang]')
  if (!langEl) return

  const view = editorView.value
  if (!view) return

  // Use posAtCoords to get the document position near the click
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos == null) return

  // Find the FencedCode node containing this position, then get its CodeInfo
  let codeInfoFrom = -1
  let codeInfoTo = -1
  let currentLang = ''
  let fencedCodeFrom = -1
  let codeMarkEnd = -1

  syntaxTree(view.state).iterate({
    from: Math.max(0, pos - 200),
    to: Math.min(view.state.doc.length, pos + 200),
    enter(node) {
      if (node.type.name === 'FencedCode' && node.from <= pos && node.to >= pos) {
        fencedCodeFrom = node.from
      }
      if (node.type.name === 'CodeInfo') {
        codeInfoFrom = node.from
        codeInfoTo = node.to
        currentLang = view.state.doc.sliceString(node.from, node.to)
      }
      // Find the end of the opening ``` mark for insertion when no CodeInfo exists
      if (node.type.name === 'CodeMark' && fencedCodeFrom >= 0 && node.from === fencedCodeFrom) {
        codeMarkEnd = node.to
      }
    }
  })

  if (codeInfoFrom >= 0) {
    // Existing CodeInfo — replace it
    const rect = langEl.getBoundingClientRect()
    langSelector.value = {
      visible: true,
      x: rect.left,
      y: rect.bottom + 4,
      from: codeInfoFrom,
      to: codeInfoTo,
      currentLang,
    }
  } else if (codeMarkEnd >= 0) {
    // No CodeInfo — insert language after opening ```
    const rect = langEl.getBoundingClientRect()
    langSelector.value = {
      visible: true,
      x: rect.left,
      y: rect.bottom + 4,
      from: codeMarkEnd,
      to: codeMarkEnd,
      currentLang: '',
    }
  }
}

function handleLangSelect(langAlias) {
  const view = editorView.value
  if (!view) return

  const { from, to } = langSelector.value

  view.dispatch({
    changes: { from, to, insert: langAlias },
  })

  langSelector.value.visible = false
}

watch(() => props.modelValue, (newVal) => {
  if (editorView.value && editorView.value.state.doc.toString() !== newVal) {
    setContent(newVal)
  }
})

watch(() => settingsStore.theme, (theme) => {
  setTheme(theme === 'dark')
}, { immediate: true })

watch(() => fileStore.filePath, () => {
  const view = editorView.value
  if (!view) return
  const sel = view.state.selection.main
  view.dispatch({
    selection: {
      anchor: sel.anchor,
      head: sel.head,
    },
  })
})

onMounted(() => {
  focus()
})
</script>

<template>
  <div ref="editorEl" class="wysiwyg-editor" @contextmenu="handleContextMenu" @click="handleClick"></div>
  <ContextMenu
    :visible="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :editorView="editorView"
    :stateVersion="editorStateVersion"
    @close="contextMenu.visible = false"
  />
  <SelectionToolbar
    :visible="selectionToolbar.visible"
    :x="selectionToolbar.x"
    :y="selectionToolbar.y"
    :editorView="editorView"
    :stateVersion="editorStateVersion"
    @close="selectionToolbar.visible = false"
  />
  <LanguageSelector
    :visible="langSelector.visible"
    :x="langSelector.x"
    :y="langSelector.y"
    :currentLang="langSelector.currentLang"
    @select="handleLangSelect"
    @close="langSelector.visible = false"
  />
</template>

<style scoped>
.wysiwyg-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wysiwyg-editor :deep(.cm-editor) {
  height: 100%;
  font-size: var(--editor-font-size, 15px);
  background-color: var(--editor-bg);
}

.wysiwyg-editor :deep(.cm-scroller) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
  overflow-x: hidden;
}

.wysiwyg-editor :deep(.cm-content) {
  caret-color: var(--editor-cursor);
  max-width: 780px;
  margin: 0 auto;
  padding: 24px 16px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.wysiwyg-editor :deep(.cm-cursor) {
  border-left: 2px solid var(--editor-cursor);
  border-left-color: var(--editor-cursor);
}

.wysiwyg-editor :deep(.cm-gutters) {
  display: none;
}

.wysiwyg-editor :deep(.cm-line) {
  line-height: 1.75;
  padding: 1px 8px;
}

.wysiwyg-editor :deep(.cm-activeLine) {
  background-color: var(--editor-active-line);
  border-radius: 4px;
}

.wysiwyg-editor :deep(.cm-selectionBackground),
.wysiwyg-editor :deep(.cm-focused .cm-selectionBackground) {
  background-color: var(--editor-selection) !important;
  border-radius: 2px;
}

/* Code block in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-heading) {
  color: var(--wysiwyg-heading, var(--preview-heading)) !important;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-code-block) {
  background-color: var(--preview-code-bg);
  font-family: var(--editor-font-family);
  font-size: 0.9em;
  line-height: 1.5;
  padding-left: 16px;
}

.wysiwyg-editor :deep(.cm-wysiwyg-code-info) {
  opacity: 0.5;
  font-size: 0.85em;
}

/* Table in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-line) {
  border-left: 1px solid var(--preview-table-border);
  border-right: 1px solid var(--preview-table-border);
  padding: 2px 8px;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-first) {
  border-top: 1px solid var(--preview-table-border);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-header) {
  background-color: var(--preview-table-header-bg);
  border-bottom: 2px solid var(--preview-table-border);
  font-weight: 600;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-row) {
  border-bottom: 1px solid var(--preview-table-border);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-delimiter) {
  line-height: 0;
  padding: 0;
  height: 2px;
}

/* Blockquote in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote) {
  color: var(--preview-blockquote-fg);
  padding-left: 16px;
  border-left: 3px solid var(--accent);
  background-color: var(--accent-light);
}

/* Math in WYSIWYG */
.wysiwyg-editor :deep(.cm-wysiwyg-math-inline) {
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  background-color: var(--accent-light);
}

.wysiwyg-editor :deep(.cm-wysiwyg-math-block) {
  cursor: pointer;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 4px;
  background-color: var(--accent-light);
  text-align: center;
  overflow-x: auto;
}
</style>
