import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const SETTINGS_KEY = 'fluentmd-settings'

function loadSettings() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return settings && typeof settings === 'object' ? settings : {}
  } catch {
    return {}
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()
  const mode = ref(saved.mode === 'wysiwyg' ? 'wysiwyg' : 'split')
  const theme = ref('light') // 'light' | 'dark'
  const fontSize = ref(Number.isFinite(saved.fontSize) ? Math.max(12, Math.min(24, saved.fontSize)) : 15)
  const splitRatio = ref(Number.isFinite(saved.splitRatio) ? Math.max(0.2, Math.min(0.8, saved.splitRatio)) : 0.5)
  const previewSync = ref(saved.previewSync !== false)
  const sidebarPanel = ref(
    saved.sidebarPanel === 'files' || saved.sidebarPanel === 'outline'
      ? saved.sidebarPanel
      : saved.outlineVisible === true ? 'outline' : null
  )
  const outlineVisible = computed(() => sidebarPanel.value === 'outline')
  const fileTreeVisible = computed(() => sidebarPanel.value === 'files')
  let persistTimer = null

  watch(
    [mode, fontSize, splitRatio, previewSync, sidebarPanel],
    ([currentMode, currentFontSize, currentSplitRatio, currentPreviewSync, currentSidebarPanel]) => {
      if (typeof localStorage === 'undefined') return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            mode: currentMode,
            fontSize: currentFontSize,
            splitRatio: currentSplitRatio,
            previewSync: currentPreviewSync,
            sidebarPanel: currentSidebarPanel,
            outlineVisible: currentSidebarPanel === 'outline',
          }))
        } catch {
          // Storage can be disabled or full; settings should remain usable in memory.
        }
        persistTimer = null
      }, 80)
    },
    { flush: 'post' }
  )

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

  function toggleOutline() {
    sidebarPanel.value = sidebarPanel.value === 'outline' ? null : 'outline'
  }

  function setOutlineVisible(value) {
    sidebarPanel.value = value ? 'outline' : sidebarPanel.value === 'outline' ? null : sidebarPanel.value
  }

  function toggleFileTree() {
    sidebarPanel.value = sidebarPanel.value === 'files' ? null : 'files'
  }

  function setFileTreeVisible(value) {
    sidebarPanel.value = value ? 'files' : sidebarPanel.value === 'files' ? null : sidebarPanel.value
  }

  return {
    mode, theme, fontSize, splitRatio, previewSync, sidebarPanel, outlineVisible, fileTreeVisible,
    setMode, toggleTheme, setTheme, setFontSize, setSplitRatio, togglePreviewSync,
    toggleOutline, setOutlineVisible, toggleFileTree, setFileTreeVisible
  }
})
