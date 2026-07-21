<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
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
const selectionToolbar = ref({ visible: false, x: 0, y: 0, placement: 'top' })
const langSelector = ref({ visible: false, x: 0, y: 0, from: 0, to: 0, currentLang: '' })
const wysiwygPlugin = createWysiwygPlugin(() => fileStore.filePath || '')

function handleContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY }
}

function handleSelectionChange(update) {
  const sel = update.state.selection.main
  editorStore.setCursor(sel.head)
  editorStateVersion.value += 1
  if (sel.from !== sel.to && sel.length > 0) {
    const view = update.view
    const coords = view.coordsAtPos(sel.from)
    if (coords) {
      const placeBelow = coords.top < 52
      selectionToolbar.value = {
        visible: true,
        x: Math.max(84, Math.min(window.innerWidth - 84, (coords.left + coords.right) / 2)),
        y: placeBelow ? coords.bottom + 8 : coords.top - 8,
        placement: placeBelow ? 'bottom' : 'top',
      }
    }
  } else {
    selectionToolbar.value.visible = false
  }
}

const { editorView, setContent, setCursor, setTheme } = useCodeMirror(
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

  // Resolve the exact fenced block under the clicked widget. A broad range
  // scan can accidentally select the language from a neighbouring code block.
  const tree = syntaxTree(view.state)
  let fencedCode = tree.resolveInner(pos, -1)
  while (fencedCode && fencedCode.type.name !== 'FencedCode') {
    fencedCode = fencedCode.parent
  }
  if (!fencedCode) {
    fencedCode = tree.resolveInner(pos, 1)
    while (fencedCode && fencedCode.type.name !== 'FencedCode') {
      fencedCode = fencedCode.parent
    }
  }
  if (!fencedCode) return

  let codeInfoFrom = -1
  let codeInfoTo = -1
  let currentLang = ''
  let codeMarkEnd = -1
  const firstLineTo = view.state.doc.lineAt(fencedCode.from).to

  tree.iterate({
    from: fencedCode.from,
    to: Math.min(fencedCode.to, firstLineTo),
    enter(node) {
      if (node.type.name === 'CodeInfo') {
        codeInfoFrom = node.from
        codeInfoTo = node.to
        currentLang = view.state.doc.sliceString(node.from, node.to)
      }
      // Find the end of the opening ``` mark for insertion when no CodeInfo exists
      if (node.type.name === 'CodeMark' && node.from === fencedCode.from) {
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

watch(() => editorStore.navigationRequest, async () => {
  await nextTick()
  setCursor(editorStore.navigationTarget)
})

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

onMounted(async () => {
  await nextTick()
  setCursor(editorStore.cursorPos)
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
    :placement="selectionToolbar.placement"
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
  font-size: var(--content-font-size);
  background-color: var(--editor-bg);
}

.wysiwyg-editor :deep(.cm-scroller) {
  font-family: var(--content-font-family);
  overflow-x: hidden;
}

.wysiwyg-editor :deep(.cm-content) {
  caret-color: var(--editor-cursor);
  color: var(--editor-fg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 34px 24px 56px;
  line-height: var(--content-line-height);
  white-space: pre-wrap;
  word-break: break-word;
}

/* CodeMirror's Markdown token colors are useful in source mode, but leak
   through One Dark in WYSIWYG mode. Neutralize them outside fenced code while
   keeping actual code blocks syntax-highlighted. */
.wysiwyg-editor :deep(.cm-line:not(.cm-wysiwyg-code-block) span) {
  color: inherit !important;
}

.wysiwyg-editor :deep(.cm-line:not(.cm-wysiwyg-code-block) .cm-wysiwyg-link) {
  color: var(--preview-link) !important;
}

.wysiwyg-editor :deep(.cm-line:not(.cm-wysiwyg-code-block) .cm-wysiwyg-inline-code) {
  color: var(--inline-code-fg) !important;
}

.wysiwyg-editor :deep(.cm-line:not(.cm-wysiwyg-code-block) .cm-wysiwyg-image-placeholder) {
  color: var(--preview-blockquote-fg) !important;
}

.wysiwyg-editor :deep(.cm-cursor) {
  border-left: 2px solid var(--editor-cursor);
  border-left-color: var(--editor-cursor);
}

.wysiwyg-editor :deep(.cm-gutters) {
  display: none;
}

.wysiwyg-editor :deep(.cm-line) {
  line-height: var(--content-line-height);
  padding: 0 10px;
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

/* Document typography */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-heading) {
  color: var(--wysiwyg-heading, var(--preview-heading)) !important;
  letter-spacing: -0.015em;
  padding-top: 5px;
  padding-bottom: 4px;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading1) {
  font-size: var(--content-h1-size);
  font-weight: 800;
  line-height: 1.22;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading2) {
  font-size: var(--content-h2-size);
  font-weight: 700;
  line-height: 1.3;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--preview-table-border);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading3) {
  font-size: var(--content-h3-size);
  font-weight: 650;
  line-height: 1.38;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading4) {
  font-size: var(--content-h4-size);
  font-weight: 650;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading5) {
  font-size: var(--content-h5-size);
  font-weight: 650;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-ATXHeading6) {
  font-size: var(--content-h6-size);
  font-weight: 650;
  letter-spacing: 0.04em;
  opacity: 0.8;
}

.wysiwyg-editor :deep(.cm-wysiwyg-inline-code) {
  padding: 0.13em 0.42em;
  border: 1px solid var(--inline-code-border);
  border-radius: 5px;
  background: var(--inline-code-bg);
  color: var(--inline-code-fg) !important;
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--inline-code-border) 68%, transparent);
  font-family: var(--editor-font-family);
  font-size: 0.88em;
  font-weight: 560;
}

/* Code block in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-code-block) {
  box-sizing: border-box;
  background: var(--preview-code-bg);
  border-left: 1px solid var(--preview-code-border);
  border-right: 1px solid var(--preview-code-border);
  font-family: var(--editor-font-family);
  font-size: var(--content-code-size);
  line-height: 1.62;
  padding: 0 18px;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-code-first) {
  min-height: 39px;
  padding-top: 8px;
  padding-bottom: 6px;
  border-top: 1px solid var(--preview-code-border);
  border-radius: 9px 9px 0 0;
  background: var(--code-header-bg);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-code-last) {
  min-height: 13px;
  padding-bottom: 11px;
  border-bottom: 1px solid var(--preview-code-border);
  border-radius: 0 0 9px 9px;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-code-first.cm-wysiwyg-code-last) {
  border-radius: 9px;
}

.wysiwyg-editor :deep(.cm-wysiwyg-code-lang) {
  min-height: 22px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--code-label-fg) !important;
  font-family: var(--content-font-family);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.025em;
  opacity: 1;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;
}

.wysiwyg-editor :deep(.cm-wysiwyg-code-lang:hover) {
  color: var(--accent) !important;
  border-color: color-mix(in srgb, var(--accent) 25%, var(--preview-code-border));
  background: var(--accent-light);
}

.wysiwyg-editor :deep(.cm-wysiwyg-code-lang-placeholder) {
  font-style: normal;
  opacity: 0.7;
}

/* Table in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-line) {
  border-left: 1px solid var(--preview-table-border);
  border-right: 1px solid var(--preview-table-border);
  background: var(--table-bg);
  font-size: 0.9375em;
  line-height: 1.6;
  padding: 7px 8px;
  transition: background-color 150ms ease;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-first) {
  border-top: 1px solid var(--preview-table-border);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-header) {
  background-color: var(--preview-table-header-bg);
  border-bottom: 2px solid var(--preview-table-border);
  color: var(--table-header-fg) !important;
  font-weight: 700;
  border-radius: 8px 8px 0 0;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-row) {
  border-bottom: 1px solid var(--preview-table-border);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-row-alt) {
  background: var(--table-row-alt-bg);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-row:hover) {
  background: var(--table-row-hover-bg);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-last) {
  border-radius: 0 0 8px 8px;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-table-delimiter) {
  line-height: 0;
  padding: 0;
  height: 2px;
}

/* Blockquote in WYSIWYG */
.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote) {
  color: var(--preview-blockquote-fg);
  line-height: 1.68;
  padding: 0 20px;
  border-right: 1px solid color-mix(in srgb, var(--preview-blockquote-border) 24%, var(--preview-table-border));
  border-left: 4px solid var(--preview-blockquote-border);
  background: var(--blockquote-bg);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote-first) {
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--preview-blockquote-border) 24%, var(--preview-table-border));
  border-radius: 0 8px 0 0;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote-last) {
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--preview-blockquote-border) 24%, var(--preview-table-border));
  border-radius: 0 0 8px 0;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote-first.cm-wysiwyg-blockquote-last) {
  border-radius: 0 8px 8px 0;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote-depth-2) {
  width: calc(100% - 18px);
  margin-left: 18px;
  background: var(--blockquote-nested-bg);
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-blockquote-depth-3) {
  width: calc(100% - 36px);
  margin-left: 36px;
  background: var(--blockquote-nested-bg);
}

/* Math in WYSIWYG */
.wysiwyg-editor :deep(.cm-wysiwyg-math-inline) {
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  background-color: var(--accent-light);
}

.wysiwyg-editor :deep(.cm-wysiwyg-math-block) {
  display: block;
  cursor: pointer;
  padding: 12px 16px;
  margin: 8px 0;
  border: 1px solid color-mix(in srgb, var(--accent) 14%, var(--preview-table-border));
  border-radius: 8px;
  background-color: var(--accent-light);
  text-align: center;
  overflow-x: auto;
}

.wysiwyg-editor :deep(.cm-line.cm-wysiwyg-math-hidden-line) {
  height: 0;
  min-height: 0;
  line-height: 0;
  padding: 0;
}
</style>
