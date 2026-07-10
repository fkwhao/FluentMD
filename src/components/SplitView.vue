<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import EditorPanel from '@/components/EditorPanel.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import ResizableDivider from '@/components/ResizableDivider.vue'
import { useEditorStore } from '@/stores/editor'

const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

const containerEl = ref(null)

function handleResize(delta) {
  const container = containerEl.value
  if (!container) return
  const totalWidth = container.clientWidth - 1
  if (totalWidth <= 0) return
  const currentLeftPx = settingsStore.splitRatio * totalWidth
  const newLeftPx = currentLeftPx + delta
  const newRatio = Math.max(0.2, Math.min(0.8, newLeftPx / totalWidth))
  settingsStore.setSplitRatio(newRatio)
}

const leftStyle = computed(() => ({ flexGrow: settingsStore.splitRatio }))
const rightStyle = computed(() => ({ flexGrow: 1 - settingsStore.splitRatio }))
</script>

<template>
  <div ref="containerEl" class="split-container">
    <div class="split-left" :style="leftStyle">
      <EditorPanel v-model="editorStore.content" />
    </div>
    <ResizableDivider @resize="handleResize" />
    <div class="split-right" :style="rightStyle">
      <PreviewPanel :content="editorStore.content" />
    </div>
  </div>
</template>

<style scoped>
.split-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.split-left,
.split-right {
  flex-basis: 0;
  overflow: hidden;
  min-width: 0;
}

.split-left {
  border-right: none;
}
</style>
