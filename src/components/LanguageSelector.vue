<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { languages } from '@codemirror/language-data'

const props = defineProps({
  currentLang: { type: String, default: '' },
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})

const emit = defineEmits(['select', 'close'])

const RECENT_KEY = 'fluentmd-recent-languages'
const COMMON_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
  'go', 'rust', 'html', 'css', 'json', 'sql', 'bash', 'markdown',
]
const PREFERRED_ALIASES = {
  JavaScript: 'js',
  TypeScript: 'ts',
  'C++': 'cpp',
  'C#': 'csharp',
  Shell: 'bash',
  HTML: 'html',
  CSS: 'css',
  JSON: 'json',
  SQL: 'sql',
  Markdown: 'markdown',
}

const search = ref('')
const searchInput = ref(null)
const listEl = ref(null)
const dropdownEl = ref(null)
const selectedIndex = ref(0)
const recentAliases = ref([])
const adjustedPosition = ref({ left: 0, top: 0 })

const langList = computed(() => [
  {
    name: '纯文本',
    aliases: ['移除语言标记'],
    insert: '',
    searchKey: '纯文本 plain text remove language 移除语言标记',
  },
  ...languages.map((language) => ({
    name: language.name,
    aliases: language.alias || [],
    insert: PREFERRED_ALIASES[language.name] || language.alias?.[0] || language.name.toLowerCase(),
    searchKey: [language.name, ...(language.alias || [])].join(' ').toLowerCase(),
  })),
])

function findLanguage(alias) {
  const normalized = alias.toLowerCase()
  return langList.value.find((language) =>
    language.name.toLowerCase() === normalized ||
    language.insert.toLowerCase() === normalized ||
    language.aliases.some((item) => item.toLowerCase() === normalized)
  )
}

const quickLanguages = computed(() => {
  const aliases = [
    props.currentLang,
    ...recentAliases.value,
    ...COMMON_LANGUAGES,
  ].filter((alias, index, values) => alias != null && values.indexOf(alias) === index)

  const items = [langList.value[0]]
  for (const alias of aliases) {
    if (!alias) continue
    const language = findLanguage(alias)
    if (language && !items.some((item) => item.name === language.name)) items.push(language)
  }
  return items.slice(0, 18)
})

const filtered = computed(() => {
  const query = search.value.toLowerCase().trim()
  if (!query) return quickLanguages.value
  return langList.value
    .filter((language) => language.searchKey.includes(query))
    .slice(0, 60)
})

const sectionLabel = computed(() => search.value.trim() ? '搜索结果' : '快速选择')

function loadRecentLanguages() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    recentAliases.value = Array.isArray(saved) ? saved.slice(0, 6) : []
  } catch {
    recentAliases.value = []
  }
}

function rememberLanguage(alias) {
  if (!alias) return
  recentAliases.value = [alias, ...recentAliases.value.filter((item) => item !== alias)].slice(0, 6)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentAliases.value))
  } catch {
    // Recent choices are a convenience; selection still works without storage.
  }
}

function isCurrentLanguage(language) {
  const current = props.currentLang.toLowerCase()
  return language.insert.toLowerCase() === current ||
    language.aliases.some((alias) => alias.toLowerCase() === current)
}

function adjustPosition() {
  nextTick(() => {
    const dropdown = dropdownEl.value
    if (!dropdown) return
    const rect = dropdown.getBoundingClientRect()
    const gap = 10
    adjustedPosition.value = {
      left: Math.max(gap, Math.min(props.x, window.innerWidth - rect.width - gap)),
      top: Math.max(gap, Math.min(props.y, window.innerHeight - rect.height - gap)),
    }
  })
}

function resetSelection() {
  const currentIndex = filtered.value.findIndex((language) =>
    isCurrentLanguage(language)
  )
  selectedIndex.value = currentIndex >= 0 ? currentIndex : 0
  scrollToSelected()
}

watch(filtered, resetSelection)

watch(() => props.visible, (visible) => {
  if (!visible) return
  search.value = ''
  loadRecentLanguages()
  adjustedPosition.value = { left: props.x, top: props.y }
  nextTick(() => {
    adjustPosition()
    resetSelection()
    searchInput.value?.focus()
  })
})

watch([() => props.x, () => props.y], () => {
  if (props.visible) adjustPosition()
})

function selectLang(language) {
  rememberLanguage(language.insert)
  emit('select', language.insert)
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1)
    scrollToSelected()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollToSelected()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (filtered.value[selectedIndex.value]) selectLang(filtered.value[selectedIndex.value])
  }
}

function scrollToSelected() {
  nextTick(() => {
    listEl.value?.querySelector(`[data-language-index="${selectedIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function handleClickOutside(event) {
  if (props.visible && dropdownEl.value && !dropdownEl.value.contains(event.target)) emit('close')
}

function handleResize() {
  if (props.visible) adjustPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dropdownEl"
      class="lang-selector-dropdown"
      :style="{ left: adjustedPosition.left + 'px', top: adjustedPosition.top + 'px' }"
      @keydown="handleKeydown"
    >
      <header class="selector-header">
        <div>
          <strong>代码语言</strong>
          <span>选择后立即应用语法高亮</span>
        </div>
        <kbd>Esc</kbd>
      </header>

      <label class="lang-selector-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref="searchInput"
          v-model="search"
          placeholder="搜索 JavaScript、Python、Rust…"
          class="lang-search-input"
          autocomplete="off"
          aria-label="搜索代码语言"
        />
      </label>

      <div class="selector-section-label">
        <span>{{ sectionLabel }}</span>
        <span>{{ filtered.length }}</span>
      </div>

      <div ref="listEl" class="lang-selector-list" role="listbox" aria-label="代码语言列表">
        <button
          v-for="(language, index) in filtered"
          :key="language.name"
          type="button"
          role="option"
          class="lang-selector-item"
          :class="{
            selected: index === selectedIndex,
            current: isCurrentLanguage(language),
          }"
          :aria-selected="isCurrentLanguage(language)"
          :data-language-index="index"
          @mousedown.prevent="selectLang(language)"
          @mouseenter="selectedIndex = index"
        >
          <span class="language-mark">{{ language.insert ? language.insert.slice(0, 2).toUpperCase() : '—' }}</span>
          <span class="language-copy">
            <span class="lang-name">{{ language.name }}</span>
            <span v-if="language.aliases.length" class="lang-aliases">{{ language.aliases.slice(0, 3).join(' · ') }}</span>
          </span>
          <svg v-if="isCurrentLanguage(language)" class="current-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </button>

        <div v-if="!filtered.length" class="lang-selector-empty">
          <strong>没有匹配的语言</strong>
          <span>可以尝试语言名称或扩展名</span>
        </div>
      </div>

      <footer class="selector-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> 移动</span>
        <span><kbd>Enter</kbd> 选择</span>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.lang-selector-dropdown {
  position: fixed;
  z-index: 9999;
  width: 310px;
  max-height: min(430px, calc(100vh - 20px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: color-mix(in srgb, var(--menu-bg) 96%, transparent);
  border: 1px solid var(--menu-border);
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18), var(--shadow-sm);
  backdrop-filter: blur(18px);
  animation: selector-in 160ms ease-out;
}

.selector-header {
  min-height: 56px;
  padding: 11px 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--menu-border);
}

.selector-header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.selector-header strong {
  color: var(--menu-fg);
  font-size: 13px;
  font-weight: 700;
}

.selector-header span {
  color: var(--statusbar-fg);
  font-size: 10px;
}

kbd {
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--menu-border);
  border-bottom-color: color-mix(in srgb, var(--menu-border) 70%, var(--menu-fg));
  border-radius: 4px;
  background: var(--toolbar-bg);
  color: var(--statusbar-fg);
  font-family: var(--editor-font-family);
  font-size: 9px;
  font-weight: 500;
}

.lang-selector-search {
  height: 42px;
  margin: 10px 10px 7px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--menu-border);
  border-radius: 8px;
  background: var(--editor-bg);
  color: var(--statusbar-fg);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.lang-selector-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.lang-search-input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--editor-fg);
  font: inherit;
  font-size: 12px;
}

.lang-search-input::placeholder {
  color: var(--statusbar-fg);
}

.selector-section-label {
  height: 25px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--statusbar-fg);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.lang-selector-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 7px 7px;
}

.lang-selector-item {
  width: 100%;
  min-height: 44px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--menu-fg);
  cursor: pointer;
  text-align: left;
  transition: background-color 120ms ease;
}

.lang-selector-item:hover,
.lang-selector-item.selected {
  background: var(--menu-hover);
}

.lang-selector-item.current {
  background: var(--accent-light);
}

.lang-selector-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.language-mark {
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--menu-border);
  border-radius: 6px;
  background: var(--toolbar-bg);
  color: var(--statusbar-fg);
  font-family: var(--editor-font-family);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.current .language-mark {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--menu-border));
  color: var(--accent);
}

.language-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lang-name {
  overflow: hidden;
  color: var(--menu-fg);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-aliases {
  overflow: hidden;
  color: var(--statusbar-fg);
  font-family: var(--editor-font-family);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-check {
  flex: 0 0 auto;
  color: var(--accent);
}

.lang-selector-empty {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--statusbar-fg);
  text-align: center;
}

.lang-selector-empty strong {
  color: var(--menu-fg);
  font-size: 12px;
}

.lang-selector-empty span {
  font-size: 10px;
}

.selector-footer {
  min-height: 34px;
  padding: 6px 11px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-top: 1px solid var(--menu-border);
  color: var(--statusbar-fg);
  font-size: 9px;
}

.selector-footer span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

@keyframes selector-in {
  from { opacity: 0; transform: translateY(-5px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .lang-selector-dropdown { animation: none; }
  .lang-selector-item,
  .lang-selector-search { transition: none; }
}
</style>
