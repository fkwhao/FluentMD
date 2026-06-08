<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useCodeMirror } from '@/composables/useCodeMirror'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { wysiwygPlugin, wysiwygTheme } from '@/utils/wysiwygDecorations'
import ContextMenu from '@/components/ContextMenu.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const editorEl = ref(null)
const editorStateVersion = ref(0)

const contextMenu = ref({ visible: false, x: 0, y: 0 })
const selectionToolbar = ref({ visible: false, x: 0, y: 0 })

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

watch(() => props.modelValue, (newVal) => {
  if (editorView.value && editorView.value.state.doc.toString() !== newVal) {
    setContent(newVal)
  }
})

watch(() => settingsStore.theme, (theme) => {
  setTheme(theme === 'dark')
}, { immediate: true })

onMounted(() => {
  focus()
})
</script>

<template>
  <div ref="editorEl" class="wysiwyg-editor" @contextmenu="handleContextMenu"></div>
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
</style>
