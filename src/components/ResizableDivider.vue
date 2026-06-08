<script setup>
const emit = defineEmits(['resize'])

let isDragging = false
let startY = 0

function onMouseDown(e) {
  isDragging = true
  startY = e.clientX
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e) {
  if (!isDragging) return
  const delta = e.clientX - startY
  startY = e.clientX
  emit('resize', delta)
}

function onMouseUp() {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}
</script>

<template>
  <div class="resizable-divider" @mousedown="onMouseDown"></div>
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
  width: 2px;
}
</style>
