<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'FileTreeNode' })

const props = defineProps({
  node: { type: Object, required: true },
  activePath: { type: String, default: '' },
  openingPath: { type: String, default: '' },
  depth: { type: Number, default: 0 },
})

const emit = defineEmits(['open'])
const expanded = ref(true)

function normalized(path) {
  return (path || '').replace(/\\/g, '/').toLocaleLowerCase()
}

const isActive = computed(() => normalized(props.node.path) === normalized(props.activePath))
const isOpening = computed(() => normalized(props.node.path) === normalized(props.openingPath))

function handleFolderKeydown(event) {
  if (event.key === 'ArrowRight' && !expanded.value) {
    event.preventDefault()
    expanded.value = true
  } else if (event.key === 'ArrowLeft' && expanded.value) {
    event.preventDefault()
    expanded.value = false
  }
}
</script>

<template>
  <li class="tree-node">
    <button
      v-if="node.type === 'directory'"
      class="tree-row folder-row"
      type="button"
      :style="{ '--tree-depth': depth }"
      :aria-expanded="expanded"
      :title="node.path"
      @click="expanded = !expanded"
      @keydown="handleFolderKeydown"
    >
      <svg class="tree-chevron" :class="{ expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M4.25 2.5 7.75 6l-3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg class="tree-icon folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6A2.5 2.5 0 0 1 20.5 9.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      </svg>
      <span class="tree-label">{{ node.name }}</span>
      <span class="folder-count">{{ node.children.length }}</span>
    </button>

    <template v-else>
      <button
        class="tree-row file-row"
        :class="{ active: isActive, opening: isOpening }"
        type="button"
        :style="{ '--tree-depth': depth }"
        :aria-current="isActive ? 'page' : undefined"
        :disabled="isOpening"
        :title="node.path"
        @click="emit('open', node)"
      >
        <span class="tree-chevron-spacer" aria-hidden="true"></span>
        <svg class="tree-icon file-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 3.5h7l5 5v12H6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M13 3.5v5h5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="m8.5 16 1-4 1.5 3 1.5-3 1 4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="tree-label">{{ node.name }}</span>
        <span v-if="isOpening" class="opening-dot" aria-label="正在打开"></span>
      </button>
    </template>

    <ul v-if="node.type === 'directory' && expanded" class="tree-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :active-path="activePath"
        :opening-path="openingPath"
        :depth="depth + 1"
        @open="emit('open', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-node,
.tree-children {
  list-style: none;
}

.tree-row {
  position: relative;
  width: 100%;
  min-height: 34px;
  padding: 5px 8px 5px calc(8px + var(--tree-depth) * 13px);
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--editor-fg);
  text-align: left;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.tree-row:hover {
  background: var(--toolbar-hover);
}

.tree-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tree-row.active {
  color: var(--accent);
  background: var(--outline-active);
}

.tree-row.active::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.tree-row:disabled {
  cursor: wait;
}

.tree-chevron,
.tree-chevron-spacer {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  color: var(--statusbar-fg);
}

.tree-chevron {
  transition: transform 150ms ease;
}

.tree-chevron.expanded {
  transform: rotate(90deg);
}

.tree-icon {
  flex: 0 0 auto;
}

.folder-icon {
  color: var(--tree-folder-fg);
}

.file-icon {
  color: var(--tree-file-fg);
}

.tree-row.active .file-icon {
  color: var(--accent);
}

.tree-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
}

.folder-row .tree-label {
  font-weight: 600;
}

.file-row.active .tree-label {
  font-weight: 650;
}

.folder-count {
  color: var(--statusbar-fg);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.opening-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: opening-pulse 900ms ease-in-out infinite;
}

@keyframes opening-pulse {
  50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .tree-row,
  .tree-chevron { transition: none; }
  .opening-dot { animation: none; }
}
</style>
