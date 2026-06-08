import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const mode = ref('split') // 'split' | 'wysiwyg'
  const theme = ref('light') // 'light' | 'dark'
  const fontSize = ref(15)
  const splitRatio = ref(0.5) // 0-1, left panel ratio
  const previewSync = ref(true)

  function setMode(newMode) {
    mode.value = newMode
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  function setTheme(newTheme) {
    theme.value = newTheme
  }

  function setFontSize(size) {
    fontSize.value = size
  }

  function setSplitRatio(ratio) {
    splitRatio.value = ratio
  }

  function togglePreviewSync() {
    previewSync.value = !previewSync.value
  }

  return {
    mode, theme, fontSize, splitRatio, previewSync,
    setMode, toggleTheme, setTheme, setFontSize, setSplitRatio, togglePreviewSync
  }
})
