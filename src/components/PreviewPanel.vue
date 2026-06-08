<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { renderToBlocks } from '@/utils/markdown'
import { computeVisibleBlocks, getBlockOffset } from '@/utils/virtualScroll'
import { debounce } from '@/utils/debounce'

const props = defineProps({
  content: { type: String, default: '' },
})

const blocks = ref([])
const containerEl = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const blockRefs = ref(new Map())
const forceUpdate = ref(0)

const debouncedRender = debounce((text) => {
  blocks.value = renderToBlocks(text)
  forceUpdate.value++
}, 150)

watch(() => props.content, (newVal) => {
  debouncedRender(newVal)
}, { immediate: true })

function onScroll(e) {
  scrollTop.value = e.target.scrollTop
  measureVisibleBlocks()
}

function onResize() {
  if (!containerEl.value) return
  viewportHeight.value = containerEl.value.clientHeight
}

function measureVisibleBlocks() {
  let changed = false
  for (const [index, el] of blockRefs.value.entries()) {
    if (el && blocks.value[index] && !blocks.value[index].measuredHeight) {
      blocks.value[index].measuredHeight = el.offsetHeight
      changed = true
    }
  }
  if (changed) forceUpdate.value++
}

function setBlockRef(index) {
  return (el) => {
    if (el) {
      blockRefs.value.set(index, el)
      if (blocks.value[index] && !blocks.value[index].measuredHeight) {
        nextTick(() => {
          if (el.offsetHeight > 0) {
            blocks.value[index].measuredHeight = el.offsetHeight
            forceUpdate.value++
          }
        })
      }
    }
  }
}

const visible = computed(() => {
  forceUpdate.value
  if (!blocks.value.length) return { items: [], totalHeight: 0 }
  const { startIndex, endIndex, totalHeight } = computeVisibleBlocks(
    blocks.value, scrollTop.value, viewportHeight.value
  )
  const items = []
  for (let i = startIndex; i <= endIndex; i++) {
    items.push({
      index: i,
      block: blocks.value[i],
      offset: getBlockOffset(blocks.value, i),
    })
  }
  return { items, totalHeight }
})

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div ref="containerEl" class="preview-panel" @scroll="onScroll">
    <div class="preview-spacer" :style="{ height: visible.totalHeight + 'px' }">
      <div
        v-for="item in visible.items"
        :key="item.index"
        :ref="setBlockRef(item.index)"
        class="preview-block"
        :style="{ position: 'absolute', top: item.offset + 'px', left: 0, right: 0 }"
        v-html="item.block.html"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background-color: var(--preview-bg);
  padding: 32px 40px;
}

.preview-spacer {
  position: relative;
}

.preview-block {
  padding: 4px 0;
}

/* Typography */
.preview-block :deep(h1) {
  font-size: 2em;
  font-weight: 800;
  margin: 1em 0 0.5em;
  color: var(--preview-heading);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.preview-block :deep(h2) {
  font-size: 1.5em;
  font-weight: 700;
  margin: 0.8em 0 0.4em;
  color: var(--preview-heading);
  letter-spacing: -0.01em;
  line-height: 1.3;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--preview-table-border);
}

.preview-block :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 0.7em 0 0.3em;
  color: var(--preview-heading);
  line-height: 1.4;
}

.preview-block :deep(h4) { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; color: var(--preview-heading); }
.preview-block :deep(h5) { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.3em; color: var(--preview-heading); opacity: 0.85; }
.preview-block :deep(h6) { font-size: 0.9em; font-weight: 600; margin: 0.5em 0 0.3em; color: var(--preview-heading); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }

.preview-block :deep(p) {
  margin: 0.6em 0;
  line-height: 1.75;
  color: var(--preview-fg);
}

.preview-block :deep(a) {
  color: var(--preview-link);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s;
}

.preview-block :deep(a:hover) {
  border-bottom-color: var(--preview-link);
}

.preview-block :deep(code) {
  background-color: var(--preview-code-bg);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: var(--editor-font-family);
  border: 1px solid var(--preview-code-border);
}

.preview-block :deep(pre) {
  background-color: var(--preview-code-bg);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 0.8em 0;
  border: 1px solid var(--preview-code-border);
  box-shadow: var(--shadow-sm);
}

.preview-block :deep(pre code) {
  background: none;
  padding: 0;
  border: none;
  font-size: 0.875em;
  line-height: 1.6;
}

.preview-block :deep(blockquote) {
  border-left: 3px solid var(--preview-blockquote-border);
  padding: 4px 16px;
  margin: 0.8em 0;
  color: var(--preview-blockquote-fg);
  background-color: var(--accent-light);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.preview-block :deep(ul),
.preview-block :deep(ol) {
  padding-left: 24px;
  margin: 0.6em 0;
}

.preview-block :deep(li) {
  line-height: 1.75;
  margin: 2px 0;
}

.preview-block :deep(li::marker) {
  color: var(--accent);
}

.preview-block :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--preview-table-border);
}

.preview-block :deep(th),
.preview-block :deep(td) {
  border: 1px solid var(--preview-table-border);
  padding: 8px 14px;
  text-align: left;
}

.preview-block :deep(th) {
  background-color: var(--preview-table-header-bg);
  font-weight: 600;
  font-size: 0.9em;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.preview-block :deep(tr:nth-child(even)) {
  background-color: var(--preview-table-header-bg);
}

.preview-block :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  margin: 0.5em 0;
}

.preview-block :deep(hr) {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--preview-table-border), transparent);
  margin: 1.5em 0;
}

.preview-block :deep(strong) { font-weight: 700; color: var(--preview-heading); }
.preview-block :deep(em) { font-style: italic; }
</style>
