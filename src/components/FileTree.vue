<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useFileStore } from '@/stores/file'
import { useSettingsStore } from '@/stores/settings'
import { useFileOperations } from '@/composables/useFileOperations'
import FileTreeNode from '@/components/FileTreeNode.vue'

const fileStore = useFileStore()
const settingsStore = useSettingsStore()
const { openFilePath } = useFileOperations()
const isDesktop = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

const rootPath = ref('')
const nodes = ref([])
const loading = ref(false)
const openingPath = ref('')
const errorMessage = ref('')
const truncated = ref(false)
let loadRequest = 0

const rootName = computed(() => {
  if (!rootPath.value) return '当前目录'
  const parts = rootPath.value.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) || rootPath.value
})

const fileCount = computed(() => countFiles(nodes.value))

function countFiles(items) {
  return items.reduce((total, item) => (
    total + (item.type === 'file' ? 1 : countFiles(item.children || []))
  ), 0)
}

function normalizedPath(path) {
  return (path || '').replace(/\\/g, '/').toLocaleLowerCase()
}

function treeContainsPath(items, path) {
  const target = normalizedPath(path)
  return items.some((item) => (
    normalizedPath(item.path) === target ||
    (item.type === 'directory' && treeContainsPath(item.children || [], path))
  ))
}

async function refreshWorkspace() {
  const request = ++loadRequest
  rootPath.value = ''
  nodes.value = []
  errorMessage.value = ''
  truncated.value = false

  if (!fileStore.filePath) return
  if (!isDesktop) {
    errorMessage.value = '文件树仅在桌面应用中可用'
    return
  }

  loading.value = true
  try {
    const workspace = await invoke('authorize_markdown_workspace', {
      filePath: fileStore.filePath,
    })
    if (request !== loadRequest) return
    rootPath.value = workspace.rootPath
    nodes.value = workspace.nodes
    truncated.value = workspace.truncated
  } catch (err) {
    if (request !== loadRequest) return
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (request === loadRequest) loading.value = false
  }
}

async function handleOpen(node) {
  if (openingPath.value || node.path === fileStore.filePath) return
  openingPath.value = node.path
  try {
    await openFilePath(node.path, { showFileTree: false })
  } finally {
    openingPath.value = ''
  }
}

watch(() => fileStore.filePath, (path) => {
  // Switching between already listed files should keep folder expansion and
  // avoid rescanning a large workspace. New/save-as paths still refresh.
  if (path && rootPath.value && treeContainsPath(nodes.value, path)) return
  refreshWorkspace()
}, { immediate: true })

onBeforeUnmount(() => {
  loadRequest += 1
})
</script>

<template>
  <aside class="file-tree" aria-label="Markdown 文件树">
    <header class="tree-header">
      <div class="tree-heading" :title="rootPath">
        <span class="tree-eyebrow">文件</span>
        <span class="tree-root">{{ rootName }}</span>
        <span v-if="fileCount" class="tree-count">{{ fileCount }}</span>
      </div>
      <div class="tree-actions">
        <button
          class="tree-action"
          type="button"
          title="刷新文件树"
          aria-label="刷新文件树"
          :disabled="loading || !fileStore.filePath"
          @click="refreshWorkspace"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6v5h-5" /><path d="M4 18v-5h5" />
            <path d="M18.1 9A7 7 0 0 0 6.3 6.3L4 8.5M5.9 15A7 7 0 0 0 17.7 17.7L20 15.5" />
          </svg>
        </button>
        <button class="tree-action" type="button" title="关闭文件树" aria-label="关闭文件树" @click="settingsStore.setFileTreeVisible(false)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="loading" class="tree-loading" aria-live="polite">
      <span class="loading-line long"></span>
      <span class="loading-line medium"></span>
      <span class="loading-line short"></span>
    </div>

    <ul v-else-if="nodes.length" class="tree-list" aria-label="Markdown 文件">
      <FileTreeNode
        v-for="node in nodes"
        :key="node.path"
        :node="node"
        :active-path="fileStore.filePath || ''"
        :opening-path="openingPath"
        @open="handleOpen"
      />
      <li v-if="truncated" class="tree-notice">目录较大，已限制显示数量</li>
    </ul>

    <div v-else class="tree-empty">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6A2.5 2.5 0 0 1 20.5 9.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" />
        <path d="M9 12h6M12 9v6" />
      </svg>
      <p>{{ fileStore.filePath ? (errorMessage ? '无法读取目录' : '没有其他 Markdown 文件') : '尚未打开文件' }}</p>
      <span>{{ errorMessage || (fileStore.filePath ? '当前目录及子目录中只有这个文件' : '打开一个 Markdown 文件后，这里会显示同目录文件') }}</span>
      <button v-if="errorMessage && fileStore.filePath && isDesktop" type="button" @click="refreshWorkspace">重试</button>
    </div>
  </aside>
</template>

<style scoped>
.file-tree {
  width: 252px;
  height: 100%;
  flex: 0 0 252px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--outline-bg);
  border-right: 1px solid var(--toolbar-border);
  color: var(--editor-fg);
  animation: tree-in 180ms ease-out;
}

.tree-header {
  min-height: 52px;
  padding: 7px 8px 7px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--toolbar-border);
}

.tree-heading {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, auto) auto;
  align-items: center;
  column-gap: 7px;
}

.tree-eyebrow {
  grid-column: 1 / -1;
  margin-bottom: 1px;
  color: var(--statusbar-fg);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.tree-root {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
}

.tree-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--toolbar-active);
  color: var(--statusbar-fg);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.tree-actions {
  display: flex;
  align-items: center;
}

.tree-action {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--editor-fg);
  opacity: 0.48;
  cursor: pointer;
  transition: opacity 150ms ease, background-color 150ms ease;
}

.tree-action:hover:not(:disabled) {
  opacity: 0.9;
  background: var(--toolbar-hover);
}

.tree-action:disabled {
  opacity: 0.2;
  cursor: default;
}

.tree-action:focus-visible,
.tree-empty button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tree-list {
  flex: 1;
  overflow: auto;
  padding: 7px 6px 14px;
}

.tree-loading {
  padding: 14px 16px;
}

.loading-line {
  height: 28px;
  margin-bottom: 7px;
  display: block;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--toolbar-hover), var(--toolbar-active), var(--toolbar-hover));
  background-size: 220% 100%;
  animation: tree-shimmer 1.2s linear infinite;
}

.loading-line.long { width: 92%; }
.loading-line.medium { width: 74%; margin-left: 14px; }
.loading-line.short { width: 58%; }

.tree-empty {
  flex: 1;
  padding: 44px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--statusbar-fg);
}

.tree-empty svg {
  margin-bottom: 13px;
  opacity: 0.52;
}

.tree-empty p {
  margin-bottom: 6px;
  color: var(--editor-fg);
  font-size: 13px;
  font-weight: 650;
  opacity: 0.76;
}

.tree-empty span {
  font-size: 11px;
  line-height: 1.6;
}

.tree-empty button {
  min-height: 32px;
  margin-top: 14px;
  padding: 0 13px;
  border: 1px solid var(--preview-code-border);
  border-radius: var(--radius-sm);
  background: var(--menu-bg);
  color: var(--editor-fg);
  font-size: 11px;
  cursor: pointer;
}

.tree-notice {
  padding: 10px 8px;
  color: var(--statusbar-fg);
  font-size: 10px;
  line-height: 1.5;
}

@keyframes tree-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes tree-shimmer {
  to { background-position: -220% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .file-tree,
  .loading-line { animation: none; }
  .tree-action { transition: none; }
}
</style>
