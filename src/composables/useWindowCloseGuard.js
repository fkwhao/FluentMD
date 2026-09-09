import { onMounted, onBeforeUnmount } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { message } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '@/stores/editor'
import { useFileOperations } from '@/composables/useFileOperations'
import { createCloseGuard } from '@/utils/closeGuard'

export function useWindowCloseGuard() {
  const editorStore = useEditorStore()
  const { saveFile, waitForPendingSaves } = useFileOperations()
  let unlisten
  let disposed = false

  function beforeUnload(event) {
    if (!editorStore.isDirty) return
    event.preventDefault()
    event.returnValue = ''
  }

  function reportError(error) {
    console.error('Close protection failed:', error)
    window.alert(`退出保护失败，窗口将保持打开：${error instanceof Error ? error.message : String(error)}`)
  }

  onMounted(async () => {
    if (!isTauri()) {
      window.addEventListener('beforeunload', beforeUnload)
      return
    }
    try {
      const appWindow = getCurrentWindow()
      const stop = await appWindow.onCloseRequested(createCloseGuard({
        isDirty: () => editorStore.isDirty,
        snapshot: () => ({ documentId: editorStore.documentId, content: editorStore.content }),
        save: saveFile,
        waitForPendingSaves,
        async choose() {
          const choice = await message('当前文档有未保存的更改，是否保存后退出？', {
            title: 'FluentMD', kind: 'warning',
            buttons: { yes: '保存', no: '不保存', cancel: '取消' },
          })
          if (choice === 'Yes' || choice === '保存') return 'save'
          if (choice === 'No' || choice === '不保存') return 'discard'
          return 'cancel'
        },
        close: () => appWindow.destroy(),
        reportError,
      }))
      if (disposed) stop()
      else unlisten = stop
    } catch (error) {
      console.error('Could not register close protection:', error)
      window.alert('无法启用退出保护，请先手动保存文档，再关闭窗口。')
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    unlisten?.()
    window.removeEventListener('beforeunload', beforeUnload)
  })
}
