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

const search = ref('')
const searchInput = ref(null)
const listEl = ref(null)

const langList = computed(() => {
  return languages.map(l => ({
    name: l.name,
    aliases: l.alias || [],
    insert: (l.alias && l.alias[0]) ? l.alias[0] : l.name.toLowerCase(),
    searchKey: [l.name, ...(l.alias || [])].join(' ').toLowerCase(),
  }))
})

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return langList.value.slice(0, 50)
  return langList.value.filter(l => l.searchKey.includes(q))
})

const selectedIndex = ref(0)

watch(filtered, () => {
  selectedIndex.value = 0
  scrollToSelected()
})

watch(() => props.visible, (val) => {
  if (val) {
    search.value = props.currentLang || ''
    selectedIndex.value = 0
    nextTick(() => {
      searchInput.value?.focus()
      searchInput.value?.select?.()
    })
  }
})

watch(() => props.currentLang, (lang) => {
  if (props.visible) {
    search.value = lang || ''
  }
})

function selectLang(lang) {
  emit('select', lang.insert)
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1)
    scrollToSelected()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollToSelected()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (filtered.value[selectedIndex.value]) {
      selectLang(filtered.value[selectedIndex.value])
    }
  }
}

function scrollToSelected() {
  nextTick(() => {
    if (listEl.value) {
      const item = listEl.value.children[selectedIndex.value]
      item?.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handleClickOutside(e) {
  if (!e.target.closest('.lang-selector-dropdown')) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lang-selector-dropdown"
      :style="{ left: x + 'px', top: y + 'px' }"
      @keydown="handleKeydown"
    >
      <div class="lang-selector-search">
        <input
          ref="searchInput"
          v-model="search"
          placeholder="Search language..."
          class="lang-search-input"
        />
      </div>
      <div ref="listEl" class="lang-selector-list">
        <div
          v-for="(lang, i) in filtered"
          :key="lang.name"
          class="lang-selector-item"
          :class="{ selected: i === selectedIndex }"
          @mousedown.prevent="selectLang(lang)"
          @mouseenter="selectedIndex = i"
        >
          <span class="lang-name">{{ lang.name }}</span>
          <span v-if="lang.aliases.length" class="lang-aliases">{{ lang.aliases.slice(0, 2).join(', ') }}</span>
        </div>
        <div v-if="!filtered.length" class="lang-selector-empty">
          No languages found
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lang-selector-dropdown {
  position: fixed;
  z-index: 9999;
  width: 240px;
  max-height: 320px;
  background-color: var(--menu-bg);
  border: 1px solid var(--menu-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lang-selector-search {
  padding: 8px;
  border-bottom: 1px solid var(--menu-border);
}

.lang-search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--menu-border);
  border-radius: var(--radius-sm);
  background-color: var(--editor-bg);
  color: var(--editor-fg);
  font-size: 13px;
  outline: none;
}

.lang-search-input:focus {
  border-color: var(--accent);
}

.lang-selector-list {
  overflow-y: auto;
  max-height: 260px;
}

.lang-selector-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--menu-fg);
}

.lang-selector-item:hover,
.lang-selector-item.selected {
  background-color: var(--menu-hover);
}

.lang-selector-item.selected {
  background-color: var(--accent-light);
}

.lang-name {
  font-weight: 500;
}

.lang-aliases {
  font-size: 11px;
  opacity: 0.5;
}

.lang-selector-empty {
  padding: 16px;
  text-align: center;
  color: var(--menu-fg);
  opacity: 0.5;
  font-size: 13px;
}
</style>
