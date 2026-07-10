import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useEditorStore } from '@/stores/editor'
import { useFileStore } from '@/stores/file'
import { useSettingsStore } from '@/stores/settings'

export function useFileOperations() {
  const editorStore = useEditorStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()

  function reportError(action, err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${action} failed:`, err)
    window.alert(`${action}失败：${message}`)
  }

  function confirmDiscardChanges() {
    return !editorStore.isDirty || confirm('当前文件未保存，是否放弃更改？')
  }

  async function openFilePath(path, options = {}) {
    const { skipDirtyCheck = false, showFileTree = true } = options
    if (!path || (!skipDirtyCheck && !confirmDiscardChanges())) return false

    try {
      const content = await readTextFile(path)
      editorStore.setContent(content)
      const name = path.split(/[/\\]/).pop() || '未命名'
      fileStore.setFile(path, name)
      if (showFileTree) settingsStore.setFileTreeVisible(true)
      return true
    } catch (err) {
      reportError('打开文件', err)
      return false
    }
  }

  async function openFile() {
    if (!confirmDiscardChanges()) return

    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      })

      if (!path) return

      await openFilePath(path, { skipDirtyCheck: true })
    } catch (err) {
      reportError('打开文件', err)
    }
  }

  async function saveFile() {
    if (!fileStore.filePath) {
      return saveFileAs()
    }

    try {
      await writeTextFile(fileStore.filePath, editorStore.content)
      editorStore.markClean()
    } catch (err) {
      reportError('保存文件', err)
    }
  }

  async function saveFileAs() {
    try {
      const path = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (!path) return

      await writeTextFile(path, editorStore.content)
      const name = path.split(/[/\\]/).pop() || '未命名'
      fileStore.setFile(path, name)
      editorStore.markClean()
      settingsStore.setFileTreeVisible(true)
    } catch (err) {
      reportError('另存文件', err)
    }
  }

  function newFile() {
    if (!confirmDiscardChanges()) return
    editorStore.setContent('')
    fileStore.clearFile()
  }

  return { openFile, openFilePath, saveFile, saveFileAs, newFile }
}
