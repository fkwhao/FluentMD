<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useFileStore } from '@/stores/file'
import { useEditorStore } from '@/stores/editor'
import { useFileOperations } from '@/composables/useFileOperations'

const settingsStore = useSettingsStore()
const fileStore = useFileStore()
const editorStore = useEditorStore()
const { openFile, saveFile, newFile } = useFileOperations()

function handleModeSwitch() {
  settingsStore.setMode(settingsStore.mode === 'split' ? 'wysiwyg' : 'split')
}

function handleThemeToggle() {
  settingsStore.toggleTheme()
}

function handleKeydown(e) {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault()
        newFile()
        break
      case 'o':
        e.preventDefault()
        openFile()
        break
      case 's':
        e.preventDefault()
        saveFile()
        break
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <button class="toolbar-btn" @click="newFile" title="新建 (Ctrl+N)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="12" x2="12" y2="18"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </button>
      <button class="toolbar-btn" @click="openFile" title="打开 (Ctrl+O)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button class="toolbar-btn" @click="saveFile" title="保存 (Ctrl+S)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </button>
      <span class="toolbar-separator"></span>
      <span class="file-name" :class="{ dirty: editorStore.isDirty }">
        {{ fileStore.fileName }}
      </span>
    </div>
    <div class="toolbar-right">
      <button
        class="toolbar-btn mode-btn"
        :class="{ active: settingsStore.mode === 'wysiwyg' }"
        @click="handleModeSwitch"
        :title="settingsStore.mode === 'split' ? '所见即所得' : '分屏模式'"
      >
        <svg v-if="settingsStore.mode === 'split'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="12" y1="3" x2="12" y2="21"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="toolbar-btn theme-btn" @click="handleThemeToggle" :title="settingsStore.theme === 'light' ? '暗色主题' : '亮色主题'">
        <svg v-if="settingsStore.theme === 'light'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background-color: var(--toolbar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  user-select: none;
  -webkit-app-region: drag;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--editor-fg);
  opacity: 0.55;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  opacity: 0.9;
  background-color: var(--toolbar-hover);
}

.toolbar-btn:active {
  background-color: var(--toolbar-active);
  opacity: 1;
}

.toolbar-btn.active {
  opacity: 1;
  background-color: var(--accent-light);
  color: var(--accent);
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background-color: var(--toolbar-border);
  margin: 0 8px;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--editor-fg);
  opacity: 0.5;
  letter-spacing: 0.01em;
}

.file-name.dirty {
  opacity: 0.8;
}

.file-name.dirty::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--accent);
  margin-left: 6px;
  vertical-align: middle;
}
</style>
