import { onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useTheme() {
  const settingsStore = useSettingsStore()

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  function toggleTheme() {
    settingsStore.toggleTheme()
  }

  onMounted(() => {
    const saved = settingsStore.theme
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    applyTheme(saved || preferred)

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('fluentmd-theme')) {
        settingsStore.setTheme(e.matches ? 'dark' : 'light')
      }
    })
  })

  watch(() => settingsStore.theme, (theme) => {
    applyTheme(theme)
    localStorage.setItem('fluentmd-theme', theme)
  })

  return { toggleTheme, applyTheme }
}
