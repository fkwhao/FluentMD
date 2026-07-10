import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const content = ref('')
  const cursorPos = ref(0)
  const isDirty = ref(false)
  const navigationTarget = ref(0)
  const navigationRequest = ref(0)

  const wordCount = computed(() => {
    const text = normalizeVisibleText(content.value)
    if (!text) return 0
    return text.length
  })

  const lineCount = computed(() => {
    const text = content.value
    if (!text) return 1
    return text.split('\n').length
  })

  const charCount = computed(() => content.value.length)

  const currentLine = computed(() => {
    const safeCursor = Math.max(0, Math.min(cursorPos.value, content.value.length))
    return content.value.slice(0, safeCursor).split('\n').length
  })

  function setContent(text) {
    content.value = text
    cursorPos.value = 0
    navigationTarget.value = 0
    isDirty.value = false
  }

  function updateContent(text) {
    content.value = text
    isDirty.value = true
  }

  function setCursor(pos) {
    cursorPos.value = pos
  }

  function navigateTo(pos) {
    navigationTarget.value = Math.max(0, Math.min(pos, content.value.length))
    cursorPos.value = navigationTarget.value
    navigationRequest.value += 1
  }

  function markClean() {
    isDirty.value = false
  }

  function markDirty() {
    isDirty.value = true
  }

  function normalizeVisibleText(text) {
    return text
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''))
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^\s*([-*+]|(\d+\.))\s+/gm, '')
      .replace(/^\s*\|/gm, '')
      .replace(/\|\s*$/gm, '')
      .replace(/^\s*([-=_])\1{2,}\s*$/gm, '')
      .replace(/\s+/g, '')
  }

  return {
    content, cursorPos, isDirty, navigationTarget, navigationRequest,
    wordCount, lineCount, charCount, currentLine,
    setContent, updateContent, setCursor, navigateTo, markClean, markDirty
  }
})
