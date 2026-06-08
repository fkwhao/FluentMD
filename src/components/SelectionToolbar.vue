<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { toggleBold, toggleItalic, toggleStrikethrough, toggleInlineCode, toggleLink, isFormatActive } from '@/utils/formatCommands'

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  editorView: Object,
  stateVersion: Number,
})

const emit = defineEmits(['close'])

const toolbarEl = ref(null)

const tools = computed(() => {
  props.stateVersion
  const view = props.editorView
  if (!view) return []
  return [
    { label: 'B', action: () => toggleBold(view), active: isFormatActive(view, 'bold'), style: 'font-weight:700' },
    { label: 'I', action: () => toggleItalic(view), active: isFormatActive(view, 'italic'), style: 'font-style:italic' },
    { label: 'S', action: () => toggleStrikethrough(view), active: isFormatActive(view, 'strikethrough'), style: 'text-decoration:line-through' },
    { label: '</>', action: () => toggleInlineCode(view), active: isFormatActive(view, 'code') },
    { label: '🔗', action: () => toggleLink(view) },
  ]
})

function handleAction(action) {
  action()
  emit('close')
}

function onClickOutside(e) {
  if (toolbarEl.value && !toolbarEl.value.contains(e.target)) {
    emit('close')
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && editorView"
      ref="toolbarEl"
      class="selection-toolbar"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <button
        v-for="tool in tools"
        :key="tool.label"
        class="toolbar-tool"
        :class="{ active: tool.active }"
        :style="tool.style"
        @mousedown.prevent="handleAction(tool.action)"
        :title="tool.label === 'B' ? '加粗' : tool.label === 'I' ? '斜体' : tool.label === 'S' ? '删除线' : tool.label === '</>' ? '行内代码' : '链接'"
      >
        {{ tool.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.selection-toolbar {
  position: fixed;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px;
  background-color: var(--menu-bg, #ffffff);
  border: 1px solid var(--menu-border, #e5e5e7);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: toolbarIn 0.15s ease-out;
  transform: translateX(-50%);
  user-select: none;
}

@keyframes toolbarIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.95); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.toolbar-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--menu-fg, #1d1d1f);
  font-size: 13px;
  font-family: var(--editor-font-family, monospace);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.toolbar-tool:hover {
  background-color: var(--menu-hover, rgba(0, 0, 0, 0.06));
}

.toolbar-tool.active {
  color: var(--accent, #007aff);
  background-color: var(--accent-light, rgba(0, 122, 255, 0.08));
}
</style>
