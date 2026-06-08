import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useEditorStore } from '@/stores/editor'
import { useFileStore } from '@/stores/file'

export function useFileOperations() {
  const editorStore = useEditorStore()
  const fileStore = useFileStore()

  async function openFile() {
    if (editorStore.isDirty) {
      if (!confirm('当前文件未保存，是否放弃更改？')) return
    }

    const path = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })

    if (!path) return

    try {
      const content = await readTextFile(path)
      editorStore.setContent(content)
      const name = path.split(/[/\\]/).pop() || '未命名'
      fileStore.setFile(path, name)
    } catch (err) {
      console.error('Failed to open file:', err)
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
      console.error('Failed to save file:', err)
    }
  }

  async function saveFileAs() {
    const path = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (!path) return

    try {
      await writeTextFile(path, editorStore.content)
      const name = path.split(/[/\\]/).pop() || '未命名'
      fileStore.setFile(path, name)
      editorStore.markClean()
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }

  function newFile() {
    if (editorStore.isDirty) {
      if (!confirm('当前文件未保存，是否放弃更改？')) return
    }
    editorStore.setContent('')
    fileStore.clearFile()
  }

  return { openFile, saveFile, saveFileAs, newFile }
}
