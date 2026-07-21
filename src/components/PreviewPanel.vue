<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { prepareMarkdownHighlighter, renderToBlocks } from '@/utils/markdown'
import { computeVisibleBlocks, getBlockOffset } from '@/utils/virtualScroll'
import { debounce } from '@/utils/debounce'
import { useFileStore } from '@/stores/file'

const props = defineProps({
  content: { type: String, default: '' },
})

const fileStore = useFileStore()
const blocks = ref([])
const containerEl = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const blockRefs = ref(new Map())
const forceUpdate = ref(0)
let resizeObserver = null
let contentWidth = 0
let renderRequest = 0

const debouncedRender = debounce(async (text, basePath, request) => {
  await prepareMarkdownHighlighter(text)
  if (request !== renderRequest) return
  blockRefs.value.clear()
  blocks.value = renderToBlocks(text, basePath)
  forceUpdate.value++
}, 150)

watch(
  [() => props.content, () => fileStore.filePath],
  ([newVal, basePath]) => {
    renderRequest += 1
    debouncedRender(newVal, basePath || '', renderRequest)
  },
  { immediate: true }
)

function onScroll(e) {
  scrollTop.value = e.target.scrollTop
  measureVisibleBlocks()
}

function onResize() {
  if (!containerEl.value) return
  const newWidth = containerEl.value.clientWidth
  viewportHeight.value = containerEl.value.clientHeight
  // Width changed (e.g. splitter drag, window resize) -> text reflows, so every
  // previously measured height is now stale and must be recomputed.
  if (contentWidth && contentWidth !== newWidth) {
    invalidateAllMeasurements()
  }
  contentWidth = newWidth
  measureVisibleBlocks()
}

function invalidateAllMeasurements() {
  let changed = false
  for (const block of blocks.value) {
    if (block.measuredHeight != null) {
      block.measuredHeight = null
      changed = true
    }
  }
  if (changed) forceUpdate.value++
}

function measureVisibleBlocks() {
  let changed = false
  for (const [index, el] of blockRefs.value.entries()) {
    if (el && blocks.value[index] && blocks.value[index].measuredHeight == null) {
      const h = el.offsetHeight
      if (h > 0) {
        blocks.value[index].measuredHeight = h
        changed = true
      }
    }
  }
  if (changed) forceUpdate.value++
}

function setBlockRef(index) {
  return (el) => {
    if (!el) {
      blockRefs.value.delete(index)
      return
    }

    blockRefs.value.set(index, el)
    // Re-measure this block once it has layout, and observe any <img> inside
    // so async image loads trigger a height recompute after they decode.
    nextTick(() => {
      if (blockRefs.value.get(index) !== el) return
      if (el.offsetHeight > 0 && blocks.value[index] && blocks.value[index].measuredHeight == null) {
        blocks.value[index].measuredHeight = el.offsetHeight
        forceUpdate.value++
      }
      observeImages(el, index)
    })
  }
}

function observeImages(el, index) {
  const imgs = el.querySelectorAll('img')
  imgs.forEach((img) => {
    if (img.__measured) return
    img.__measured = true
    const handleLoad = () => {
      if (blockRefs.value.get(index) !== el) return
      // Image just decoded -> its block's height likely changed. Invalidate and
      // re-measure so the virtual scroll offsets stay correct.
      nextTick(() => {
        invalidateAllMeasurements()
        measureVisibleBlocks()
      })
    }
    if (img.complete && img.naturalWidth > 0) {
      handleLoad()
    } else {
      img.addEventListener('load', handleLoad, { once: true })
      img.addEventListener('error', handleLoad, { once: true })
    }
  })
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
  // Use ResizeObserver to detect panel size changes (splitter drag, etc.)
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(() => {
      onResize()
    })
    resizeObserver.observe(containerEl.value)
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  renderRequest += 1
  debouncedRender.cancel()
  blockRefs.value.clear()
  window.removeEventListener('resize', onResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
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
  font-family: var(--content-font-family);
  font-size: var(--content-font-size);
}

.preview-spacer {
  position: relative;
}

.preview-block {
  padding: 4px 0;
}

/* Typography */
.preview-block :deep(h1) {
  font-size: var(--content-h1-size);
  font-weight: 800;
  margin: 1em 0 0.5em;
  color: var(--preview-heading);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.preview-block :deep(h2) {
  font-size: var(--content-h2-size);
  font-weight: 700;
  margin: 0.8em 0 0.4em;
  color: var(--preview-heading);
  letter-spacing: -0.01em;
  line-height: 1.3;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--preview-table-border);
}

.preview-block :deep(h3) {
  font-size: var(--content-h3-size);
  font-weight: 600;
  margin: 0.7em 0 0.3em;
  color: var(--preview-heading);
  line-height: 1.4;
}

.preview-block :deep(h4) { font-size: var(--content-h4-size); font-weight: 600; margin: 0.6em 0 0.3em; color: var(--preview-heading); }
.preview-block :deep(h5) { font-size: var(--content-h5-size); font-weight: 600; margin: 0.5em 0 0.3em; color: var(--preview-heading); opacity: 0.85; }
.preview-block :deep(h6) { font-size: var(--content-h6-size); font-weight: 600; margin: 0.5em 0 0.3em; color: var(--preview-heading); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }

.preview-block :deep(p) {
  margin: 0.6em 0;
  line-height: var(--content-line-height);
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
  padding: 0.14em 0.42em;
  border: 1px solid var(--inline-code-border);
  border-radius: 5px;
  background-color: var(--inline-code-bg);
  color: var(--inline-code-fg);
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--inline-code-border) 68%, transparent);
  font-size: 0.88em;
  font-weight: 560;
  font-family: var(--editor-font-family);
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
  border-radius: 0;
  color: inherit;
  box-shadow: none;
  font-weight: 400;
  font-size: 0.875em;
  line-height: 1.6;
}

.preview-block :deep(.hljs-comment),
.preview-block :deep(.hljs-quote) {
  color: var(--syntax-comment);
  font-style: italic;
}

.preview-block :deep(.hljs-keyword),
.preview-block :deep(.hljs-selector-tag),
.preview-block :deep(.hljs-subst) {
  color: var(--syntax-keyword);
}

.preview-block :deep(.hljs-string),
.preview-block :deep(.hljs-doctag),
.preview-block :deep(.hljs-regexp),
.preview-block :deep(.hljs-template-tag),
.preview-block :deep(.hljs-template-variable) {
  color: var(--syntax-string);
}

.preview-block :deep(.hljs-number),
.preview-block :deep(.hljs-literal),
.preview-block :deep(.hljs-symbol),
.preview-block :deep(.hljs-bullet) {
  color: var(--syntax-number);
}

.preview-block :deep(.hljs-title),
.preview-block :deep(.hljs-section),
.preview-block :deep(.hljs-selector-id) {
  color: var(--syntax-title);
  font-weight: 600;
}

.preview-block :deep(.hljs-variable),
.preview-block :deep(.hljs-params),
.preview-block :deep(.hljs-attr),
.preview-block :deep(.hljs-attribute) {
  color: var(--syntax-variable);
}

.preview-block :deep(.hljs-built_in),
.preview-block :deep(.hljs-type),
.preview-block :deep(.hljs-class .hljs-title) {
  color: var(--syntax-type);
}

.preview-block :deep(.hljs-meta),
.preview-block :deep(.hljs-meta .hljs-keyword) {
  color: var(--syntax-meta);
}

.preview-block :deep(.hljs-addition) {
  color: var(--syntax-addition);
}

.preview-block :deep(.hljs-deletion) {
  color: var(--syntax-deletion);
}

.preview-block :deep(blockquote) {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--preview-blockquote-border) 26%, var(--preview-table-border));
  border-left: 4px solid var(--preview-blockquote-border);
  padding: 12px 20px 12px 42px;
  margin: 0.8em 0;
  color: var(--preview-blockquote-fg);
  background: var(--blockquote-bg);
  border-radius: 0 9px 9px 0;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--preview-blockquote-border) 8%, transparent);
}

.preview-block :deep(blockquote::before) {
  content: '“';
  position: absolute;
  left: 14px;
  top: 5px;
  color: var(--preview-blockquote-border);
  font-family: Georgia, serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.78;
}

.preview-block :deep(blockquote blockquote) {
  margin: 0.55em 0 0.2em;
  background: var(--blockquote-nested-bg);
}

.preview-block :deep(blockquote p),
.preview-block :deep(blockquote li) {
  color: inherit;
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

.preview-block :deep(.table-scroll) {
  width: 100%;
  margin: 0.8em 0;
  overflow-x: auto;
  border: 1px solid var(--preview-table-border);
  border-radius: 9px;
  background: var(--table-bg);
  box-shadow: var(--shadow-sm);
}

.preview-block :deep(table) {
  width: 100%;
  min-width: 480px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
}

.preview-block :deep(th),
.preview-block :deep(td) {
  padding: 10px 14px;
  border-right: 1px solid var(--preview-table-border);
  border-bottom: 1px solid var(--preview-table-border);
  text-align: left;
  vertical-align: top;
  line-height: 1.55;
}

.preview-block :deep(th:last-child),
.preview-block :deep(td:last-child) {
  border-right: 0;
}

.preview-block :deep(tr:last-child td) {
  border-bottom: 0;
}

.preview-block :deep(th) {
  background-color: var(--preview-table-header-bg);
  color: var(--table-header-fg);
  font-weight: 700;
  font-size: 0.875em;
  letter-spacing: 0.015em;
}

.preview-block :deep(tr:nth-child(even)) {
  background-color: var(--table-row-alt-bg);
}

.preview-block :deep(tbody tr) {
  transition: background-color 150ms ease;
}

.preview-block :deep(tbody tr:hover) {
  background-color: var(--table-row-hover-bg);
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

.preview-block :deep(.math-block) {
  margin: 0.8em 0;
  padding: 12px 16px;
  text-align: center;
  overflow-x: auto;
  background-color: var(--accent-light);
  border-radius: var(--radius-md);
}
</style>
