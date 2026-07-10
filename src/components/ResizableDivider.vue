<script setup>
import { onBeforeUnmount } from 'vue'

const emit = defineEmits(['resize'])

let isDragging = false
let startX = 0

function onPointerDown(e) {
  if (e.button !== 0) return
  e.preventDefault()
  isDragging = true
  startX = e.clientX
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', stopDragging)
  document.addEventListener('pointercancel', stopDragging)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onPointerMove(e) {
  if (!isDragging) return
  const delta = e.clientX - startX
  startX = e.clientX
  emit('resize', delta)
}

function stopDragging() {
  isDragging = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', stopDragging)
  document.removeEventListener('pointercancel', stopDragging)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function onKeydown(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  emit('resize', e.key === 'ArrowLeft' ? -10 : 10)
}

onBeforeUnmount(stopDragging)
</script>

<template>
  <div
    class="resizable-divider"
    role="separator"
    aria-label="调整编辑区与预览区宽度"
    aria-orientation="vertical"
    tabindex="0"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
  ></div>
</template>

<style scoped>
.resizable-divider {
  width: 1px;
  cursor: col-resize;
  background-color: var(--divider-bg);
  flex-shrink: 0;
  position: relative;
  transition: background-color 0.2s, width 0.2s;
}

.resizable-divider::after {
  content: '';
  position: absolute;
  top: 0;
  left: -4px;
  right: -4px;
  bottom: 0;
  z-index: 10;
}

.resizable-divider:hover {
  background-color: var(--divider-hover);
}

.resizable-divider:focus-visible {
  background-color: var(--divider-hover);
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
