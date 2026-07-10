<script setup>
import { defineAsyncComponent, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useEditorStore } from '@/stores/editor'
import { useTheme } from '@/composables/useTheme'
import AppToolbar from '@/components/AppToolbar.vue'
import StatusBar from '@/components/StatusBar.vue'
import DocumentOutline from '@/components/DocumentOutline.vue'

const SplitView = defineAsyncComponent(() => import('@/components/SplitView.vue'))
const WysiwygEditor = defineAsyncComponent(() => import('@/components/WysiwygEditor.vue'))
const FileTree = defineAsyncComponent(() => import('@/components/FileTree.vue'))

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
      <FileTree v-if="settingsStore.fileTreeVisible" />
      <DocumentOutline v-else-if="settingsStore.outlineVisible" />
      <section class="editor-stage">
        <SplitView v-if="settingsStore.mode === 'split'" />
        <WysiwygEditor v-else v-model="editorStore.content" />
      </section>
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
  display: flex;
  overflow: hidden;
}

.editor-stage {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
</style>
