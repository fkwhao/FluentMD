import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFileStore = defineStore('file', () => {
  const filePath = ref(null)
  const fileName = ref('未命名')
  const isWatching = ref(false)

  function setFile(path, name) {
    filePath.value = path
    fileName.value = name || '未命名'
  }

  function clearFile() {
    filePath.value = null
    fileName.value = '未命名'
    isWatching.value = false
  }

  function setWatching(value) {
    isWatching.value = value
  }

  return {
    filePath, fileName, isWatching,
    setFile, clearFile, setWatching
  }
})
