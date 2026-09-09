import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useEditorStore } from '@/stores/editor'
import { useFileStore } from '@/stores/file'
import { useSettingsStore } from '@/stores/settings'

// Toolbar, file tree and close protection must share operation ordering.
const operationStates = new WeakMap()

export function useFileOperations() {
  const editorStore = useEditorStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()
  if (!operationStates.has(editorStore)) {
    operationStates.set(editorStore, { openRequest: 0, writes: Promise.resolve() })
  }
  const operations = operationStates.get(editorStore)

  function snapshot() {
    return { documentId: editorStore.documentId, content: editorStore.content }
  }

  function isCurrent(saved) {
    return saved.documentId === editorStore.documentId
  }

  function reportError(action, err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${action} failed:`, err)
    window.alert(`${action}失败：${message}`)
  }

  function confirmDiscardChanges() {
    return !editorStore.isDirty || confirm('当前文件未保存，是否放弃更改？')
  }

  async function loadFile(path, request, approved, showFileTree) {
    try {
      const content = await readTextFile(path)
      if (request !== operations.openRequest || !isCurrent(approved)) return false
      if (editorStore.content !== approved.content && !confirmDiscardChanges()) return false
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

  async function openFilePath(path, options = {}) {
    if (!path || !confirmDiscardChanges()) return false
    const request = ++operations.openRequest
    return loadFile(path, request, snapshot(), options.showFileTree !== false)
  }

  async function openFile() {
    if (!confirmDiscardChanges()) return false
    const request = ++operations.openRequest
    const approved = snapshot()

    try {
      const path = await open({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      })

      if (!path || request !== operations.openRequest || !isCurrent(approved)) return false
      return await loadFile(path, request, approved, true)
    } catch (err) {
      reportError('打开文件', err)
      return false
    }
  }

  async function writeSnapshot(path, saved, rename = false) {
    try {
      // Serialize writes, including requests from different composable users.
      const writing = operations.writes.then(() => writeTextFile(path, saved.content))
      operations.writes = writing.catch(() => {})
      await writing
      if (!isCurrent(saved)) return false
      if (rename) {
        fileStore.setFile(path, path.split(/[/\\]/).pop() || '未命名')
        settingsStore.setFileTreeVisible(true)
      }
      if (fileStore.filePath !== path || editorStore.content !== saved.content) return false
      editorStore.markClean()
      return true
    } catch (err) {
      reportError('保存文件', err)
      return false
    }
  }

  function saveFile() {
    if (!fileStore.filePath) return saveFileAs()
    return writeSnapshot(fileStore.filePath, snapshot())
  }

  async function saveFileAs() {
    const saved = snapshot()
    try {
      const path = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })

      if (!path || !isCurrent(saved)) return false
      return await writeSnapshot(path, saved, true)
    } catch (err) {
      reportError('另存文件', err)
      return false
    }
  }

  function newFile() {
    if (!confirmDiscardChanges()) return
    operations.openRequest += 1
    editorStore.setContent('')
    fileStore.clearFile()
  }

  function waitForPendingSaves() {
    return operations.writes
  }

  return { openFile, openFilePath, saveFile, saveFileAs, newFile, waitForPendingSaves }
}
