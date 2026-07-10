<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useCodeMirror } from '@/composables/useCodeMirror'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
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
const selectionToolbar = ref({ visible: false, x: 0, y: 0, placement: 'top' })

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

watch(() => editorStore.navigationRequest, async () => {
  await nextTick()
  setCursor(editorStore.navigationTarget)
})

onMounted(async () => {
  await nextTick()
  setCursor(editorStore.cursorPos)
})
</script>

<template>
  <div ref="editorEl" class="editor-panel" @contextmenu="handleContextMenu"></div>
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
</template>

<style scoped>
.editor-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.editor-panel :deep(.cm-editor) {
  height: 100%;
  font-size: var(--editor-font-size, 15px);
  background-color: var(--editor-bg);
}

.editor-panel :deep(.cm-scroller) {
  font-family: var(--editor-font-family);
  overflow-x: hidden;
  padding: 0 4px;
}

.editor-panel :deep(.cm-content) {
  caret-color: var(--editor-cursor);
  padding: 8px 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.editor-panel :deep(.cm-cursor) {
  border-left: 2px solid var(--editor-cursor);
  border-left-color: var(--editor-cursor);
}

.editor-panel :deep(.cm-gutters) {
  background-color: var(--editor-gutter-bg);
  color: var(--editor-gutter-fg);
  border-right: none;
  padding-right: 8px;
}

.editor-panel :deep(.cm-activeLineGutter) {
  background-color: var(--editor-active-line);
  color: var(--editor-fg);
  opacity: 1;
}

.editor-panel :deep(.cm-line) {
  padding: 0 8px;
}

.editor-panel :deep(.cm-activeLine) {
  background-color: var(--editor-active-line);
  border-radius: 4px;
}

.editor-panel :deep(.cm-selectionBackground),
.editor-panel :deep(.cm-focused .cm-selectionBackground) {
  background-color: var(--editor-selection) !important;
  border-radius: 2px;
}

.editor-panel :deep(.cm-foldGutter) { opacity: 0.4; }
.editor-panel :deep(.cm-foldGutter:hover) { opacity: 1; }

</style>
