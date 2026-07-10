import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const THEME_STORAGE_KEY = 'fluentmd-theme'

export function useTheme() {
  const settingsStore = useSettingsStore()
  let mediaQuery = null
  let initialized = false
  let syncingSystemTheme = false

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  function toggleTheme() {
    settingsStore.toggleTheme()
  }

  function setSystemTheme(theme) {
    syncingSystemTheme = true
    settingsStore.setTheme(theme)
    applyTheme(theme)
    syncingSystemTheme = false
  }

  function handleSystemThemeChange(event) {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : (mediaQuery.matches ? 'dark' : 'light')

    setSystemTheme(theme)
    initialized = true
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  })

  watch(() => settingsStore.theme, (theme) => {
    applyTheme(theme)
    if (initialized && !syncingSystemTheme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, { flush: 'sync' })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', handleSystemThemeChange)
  })

  return { toggleTheme, applyTheme }
}
