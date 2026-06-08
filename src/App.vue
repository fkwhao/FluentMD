<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useEditorStore } from '@/stores/editor'
import { useTheme } from '@/composables/useTheme'
import AppToolbar from '@/components/AppToolbar.vue'
import SplitView from '@/components/SplitView.vue'
import WysiwygEditor from '@/components/WysiwygEditor.vue'
import StatusBar from '@/components/StatusBar.vue'

const settingsStore = useSettingsStore()
const editorStore = useEditorStore()
useTheme()

const initialContent = [
  '# FluentMD',
  '',
  '一个高性能 Markdown 编辑器，基于 Tauri + CodeMirror 6 构建。',
  '',
  '## 特性',
  '',
  '- **分屏模式**：左侧编辑，右侧实时预览',
  '- **所见即所得**：像 Typora 一样编辑',
  '- **虚拟滚动**：流畅处理 10 万字以上文档',
  '- **主题切换**：亮色/暗色主题',
  '',
  '## 快捷键',
  '',
  '| 快捷键 | 功能 |',
  '|--------|------|',
  '| Ctrl+N | 新建文件 |',
  '| Ctrl+O | 打开文件 |',
  '| Ctrl+S | 保存文件 |',
  '',
  '',
  '开始编辑吧！',
].join('\n')

onMounted(() => {
  editorStore.setContent(initialContent)
})
</script>

<template>
  <div class="app-container">
    <AppToolbar />
    <main class="main-content">
      <SplitView v-if="settingsStore.mode === 'split'" />
      <WysiwygEditor v-else v-model="editorStore.content" class="full-editor" />
    </main>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-container {
  display: grid;
  grid-template-rows: 48px 1fr 28px;
  height: 100vh;
  background-color: var(--editor-bg);
}

.main-content {
  overflow: hidden;
}

.full-editor {
  width: 100%;
  height: 100%;
}
</style>
