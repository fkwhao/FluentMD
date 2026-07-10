<script setup>
import { useEditorStore } from '@/stores/editor'
import { useFileStore } from '@/stores/file'

const editorStore = useEditorStore()
const fileStore = useFileStore()
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item file-label">{{ fileStore.fileName }}</span>
      <span class="status-badge" v-if="editorStore.isDirty">未保存</span>
    </div>
    <div class="status-right">
      <span class="status-item">第 {{ editorStore.currentLine }} 行 / 共 {{ editorStore.lineCount }} 行</span>
      <span class="status-sep">|</span>
      <span class="status-item">{{ editorStore.wordCount }} 字</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 16px;
  background-color: var(--statusbar-bg);
  border-top: 1px solid var(--toolbar-border);
  font-size: 11px;
  color: var(--statusbar-fg);
  user-select: none;
  letter-spacing: 0.02em;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-label {
  font-weight: 500;
}

.status-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background-color: var(--accent-light);
  color: var(--accent);
  font-weight: 500;
}

.status-sep {
  opacity: 0.3;
}
</style>
