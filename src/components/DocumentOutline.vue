<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { extractHeadings } from '@/utils/headings'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const listEl = ref(null)

const headings = computed(() => extractHeadings(editorStore.content))

const activeIndex = computed(() => {
  let active = -1
  for (let index = 0; index < headings.value.length; index++) {
    if (headings.value[index].pos > editorStore.cursorPos) break
    active = index
  }
  return active
})

function goToHeading(heading) {
  editorStore.navigateTo(heading.target ?? heading.pos)
}

watch(activeIndex, async (index) => {
  if (index < 0) return
  await nextTick()
  listEl.value?.querySelector(`[data-outline-index="${index}"]`)
    ?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <aside class="document-outline" aria-label="文档目录">
    <header class="outline-header">
      <div>
        <span class="outline-title">目录</span>
        <span v-if="headings.length" class="outline-count">{{ headings.length }}</span>
      </div>
      <button
        class="outline-close"
        type="button"
        title="关闭目录"
        aria-label="关闭目录"
        @click="settingsStore.setOutlineVisible(false)"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <nav v-if="headings.length" ref="listEl" class="outline-list" aria-label="标题列表">
      <button
        v-for="(heading, index) in headings"
        :key="`${heading.pos}-${heading.text}`"
        type="button"
        class="outline-item"
        :class="{ active: index === activeIndex }"
        :style="{ '--outline-level': Math.min(heading.level, 5) - 1 }"
        :data-outline-index="index"
        :aria-current="index === activeIndex ? 'location' : undefined"
        :title="heading.text"
        @click="goToHeading(heading)"
      >
        <span class="outline-level">H{{ heading.level }}</span>
        <span class="outline-text">{{ heading.text }}</span>
      </button>
    </nav>

    <div v-else class="outline-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5h16M4 12h10M4 19h7" />
      </svg>
      <p>暂无目录</p>
      <span>添加 Markdown 标题后会显示在这里</span>
    </div>
  </aside>
</template>

<style scoped>
.document-outline {
  width: 236px;
  height: 100%;
  flex: 0 0 236px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--outline-bg);
  border-right: 1px solid var(--toolbar-border);
  color: var(--editor-fg);
  animation: outline-in 180ms ease-out;
}

.outline-header {
  height: 44px;
  padding: 0 10px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--toolbar-border);
}

.outline-header > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.outline-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.outline-count {
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

.outline-close {
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
}

.outline-close:hover {
  opacity: 0.9;
  background: var(--toolbar-hover);
}

.outline-close:focus-visible,
.outline-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.outline-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.outline-item {
  position: relative;
  width: 100%;
  min-height: 36px;
  padding: 7px 9px 7px calc(9px + var(--outline-level) * 13px);
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--editor-fg);
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.outline-item:hover {
  background: var(--toolbar-hover);
}

.outline-item.active {
  color: var(--accent);
  background: var(--outline-active);
}

.outline-item.active::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.outline-level {
  width: 18px;
  flex: 0 0 18px;
  color: var(--statusbar-fg);
  font-family: var(--editor-font-family);
  font-size: 9px;
  font-weight: 700;
}

.outline-item.active .outline-level {
  color: var(--accent);
}

.outline-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.35;
}

.outline-empty {
  flex: 1;
  padding: 40px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--statusbar-fg);
}

.outline-empty svg {
  margin-bottom: 12px;
  opacity: 0.5;
}

.outline-empty p {
  margin-bottom: 5px;
  color: var(--editor-fg);
  font-size: 13px;
  font-weight: 600;
  opacity: 0.72;
}

.outline-empty span {
  font-size: 11px;
  line-height: 1.55;
}

@keyframes outline-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .document-outline { animation: none; }
  .outline-item { transition: none; }
}
</style>
