import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const cursorPos = ref(0)
  const isDirty = ref(false)

  const wordCount = computed(() => {
    const text = content.value.trim()
    if (!text) return 0
    return text.split(/\s+/).length
  })

  const lineCount = computed(() => {
    const text = content.value
    if (!text) return 1
    return text.split('\n').length
  })

  const charCount = computed(() => content.value.length)

  function setContent(text) {
    content.value = text
    isDirty.value = false
  }

  function updateContent(text) {
    content.value = text
    isDirty.value = true
  }

  function setCursor(pos) {
    cursorPos.value = pos
  }

  function markClean() {
    isDirty.value = false
  }

  function markDirty() {
    isDirty.value = true
  }

  return {
    content, cursorPos, isDirty,
    wordCount, lineCount, charCount,
    setContent, updateContent, setCursor, markClean, markDirty
  }
})
