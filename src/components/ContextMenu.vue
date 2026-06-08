<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import {
  toggleBold, toggleItalic, toggleStrikethrough, toggleInlineCode,
  toggleLink, insertImage, toggleHeading, toggleBlockquote,
  toggleUnorderedList, toggleOrderedList, insertCodeBlock,
  insertHorizontalRule, isFormatActive, getHeadingLevel,
} from '@/utils/formatCommands'

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  editorView: Object,
  stateVersion: Number,
})

const emit = defineEmits(['close'])

const menuEl = ref(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

const menuItems = computed(() => {
  props.stateVersion
  const view = props.editorView
  if (!view) return []

  return [
    { type: 'group', items: [
      { label: '一级标题', shortcut: 'H1', action: () => toggleHeading(view, 1), active: getHeadingLevel(view) === 1, icon: 'H1' },
      { label: '二级标题', shortcut: 'H2', action: () => toggleHeading(view, 2), active: getHeadingLevel(view) === 2, icon: 'H2' },
      { label: '三级标题', shortcut: 'H3', action: () => toggleHeading(view, 3), active: getHeadingLevel(view) === 3, icon: 'H3' },
      { label: '四级标题', shortcut: 'H4', action: () => toggleHeading(view, 4), active: getHeadingLevel(view) === 4, icon: 'H4' },
    ]},
    { type: 'separator' },
    { type: 'group', items: [
      { label: '加粗', shortcut: 'Ctrl+B', action: () => toggleBold(view), active: isFormatActive(view, 'bold'), icon: 'B' },
      { label: '斜体', shortcut: 'Ctrl+I', action: () => toggleItalic(view), active: isFormatActive(view, 'italic'), icon: 'I' },
      { label: '删除线', action: () => toggleStrikethrough(view), active: isFormatActive(view, 'strikethrough'), icon: 'S' },
      { label: '行内代码', action: () => toggleInlineCode(view), active: isFormatActive(view, 'code'), icon: '</>' },
    ]},
    { type: 'separator' },
    { type: 'group', items: [
      { label: '链接', action: () => toggleLink(view), icon: '🔗' },
      { label: '图片', action: () => insertImage(view), icon: '🖼' },
    ]},
    { type: 'separator' },
    { type: 'group', items: [
      { label: '引用', action: () => toggleBlockquote(view), active: isFormatActive(view, 'blockquote'), icon: '❝' },
      { label: '无序列表', action: () => toggleUnorderedList(view), active: isFormatActive(view, 'ul'), icon: '•' },
      { label: '有序列表', action: () => toggleOrderedList(view), active: isFormatActive(view, 'ol'), icon: '1.' },
      { label: '代码块', action: () => insertCodeBlock(view), icon: '▎' },
      { label: '分割线', action: () => insertHorizontalRule(view), icon: '—' },
    ]},
  ]
})

function adjustPosition() {
  nextTick(() => {
    if (!menuEl.value) return
    const rect = menuEl.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    adjustedX.value = props.x + rect.width > vw ? props.x - rect.width : props.x
    adjustedY.value = props.y + rect.height > vh ? props.y - rect.height : props.y

    if (adjustedX.value < 0) adjustedX.value = 4
    if (adjustedY.value < 0) adjustedY.value = 4
  })
}

function handleAction(action) {
  action()
  emit('close')
}

function onClickOutside(e) {
  if (menuEl.value && !menuEl.value.contains(e.target)) {
    emit('close')
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.visible, (v) => {
  if (v) {
    adjustedX.value = props.x
    adjustedY.value = props.y
    adjustPosition()
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuEl"
      class="context-menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
    >
      <template v-for="(item, i) in menuItems" :key="i">
        <div v-if="item.type === 'separator'" class="menu-separator" />
        <div v-else class="menu-group">
          <button
            v-for="sub in item.items"
            :key="sub.label"
            class="menu-item"
            :class="{ active: sub.active }"
            @click="handleAction(sub.action)"
          >
            <span class="menu-icon">{{ sub.icon }}</span>
            <span class="menu-label">{{ sub.label }}</span>
            <span v-if="sub.shortcut" class="menu-shortcut">{{ sub.shortcut }}</span>
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  padding: 4px;
  background-color: var(--menu-bg, #ffffff);
  border: 1px solid var(--menu-border, #e5e5e7);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  animation: menuIn 0.12s ease-out;
  user-select: none;
}

@keyframes menuIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.menu-group {
  display: flex;
  flex-direction: column;
}

.menu-separator {
  height: 1px;
  margin: 4px 8px;
  background-color: var(--menu-border, #e5e5e7);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--menu-fg, #1d1d1f);
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background-color 0.1s;
}

.menu-item:hover {
  background-color: var(--menu-hover, rgba(0, 0, 0, 0.04));
}

.menu-item.active {
  color: var(--accent, #007aff);
}

.menu-item.active .menu-icon {
  color: var(--accent, #007aff);
}

.menu-icon {
  width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
  font-family: var(--editor-font-family, monospace);
}

.menu-item.active .menu-icon {
  opacity: 1;
}

.menu-label {
  flex: 1;
}

.menu-shortcut {
  font-size: 11px;
  opacity: 0.4;
  font-family: var(--editor-font-family, monospace);
}
</style>
