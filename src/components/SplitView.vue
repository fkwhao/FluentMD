<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import EditorPanel from '@/components/EditorPanel.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import ResizableDivider from '@/components/ResizableDivider.vue'
import { useEditorStore } from '@/stores/editor'

const settingsStore = useSettingsStore()
const editorStore = useEditorStore()

const leftWidth = ref(50)

function handleResize(delta) {
  const container = document.querySelector('.split-container')
  if (!container) return
  const totalWidth = container.clientWidth - 4 // minus divider
  const currentLeftPx = (leftWidth.value / 100) * totalWidth
  const newLeftPx = currentLeftPx + delta
  const newPercent = Math.max(20, Math.min(80, (newLeftPx / totalWidth) * 100))
  leftWidth.value = newPercent
}

const leftStyle = computed(() => ({ width: leftWidth.value + '%' }))
const rightStyle = computed(() => ({ width: (100 - leftWidth.value) + '%' }))
</script>

<template>
  <div class="split-container">
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
  overflow: hidden;
  min-width: 0;
}

.split-left {
  border-right: none;
}
</style>
