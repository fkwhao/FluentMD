import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import katex from 'katex'
import { resolveMarkdownAssetSrc } from '@/utils/assetUrls'

const languageLoaders = import.meta.glob([
  '../../node_modules/highlight.js/es/languages/*.js',
  // highlight.js also ships deprecated `language.js.js` wrappers.
  '!../../node_modules/highlight.js/es/languages/*.js.js',
])
const languageLoads = new Map()
const HIGHLIGHT_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  vue: 'xml',
  md: 'markdown',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  'c#': 'csharp',
  'c++': 'cpp',
  yml: 'yaml',
  tex: 'latex',
  objc: 'objectivec',
  ps1: 'powershell',
  docker: 'dockerfile',
  jinja: 'django',
  postgresql: 'pgsql',
  rss: 'xml',
  coffee: 'coffeescript',
  edn: 'clojure',
  ls: 'livescript',
  'objective-c': 'objectivec',
  'objective-c++': 'objectivec',
  pascal: 'delphi',
  toml: 'ini',
  mysql: 'sql',
  sqlite: 'sql',
  plsql: 'sql',
  mariadb: 'sql',
  mssql: 'sql',
  sass: 'scss',
  webassembly: 'wasm',
  rscript: 'r',
  jruby: 'ruby',
}

function normalizeHighlightLanguage(language) {
  const normalized = language.toLowerCase().replace(/^\{\.?|\}$/g, '')
  return HIGHLIGHT_ALIASES[normalized] || normalized
}

async function loadHighlightLanguage(language) {
  const canonical = normalizeHighlightLanguage(language)
  if (!canonical || hljs.getLanguage(canonical)) return
  if (languageLoads.has(canonical)) return languageLoads.get(canonical)

  const key = `../../node_modules/highlight.js/es/languages/${canonical}.js`
  const loader = languageLoaders[key]
  if (!loader) return

  const loading = loader()
    .then((module) => hljs.registerLanguage(canonical, module.default))
    .catch(() => undefined)
  languageLoads.set(canonical, loading)
  return loading
}

export async function prepareMarkdownHighlighter(text) {
  const languages = new Set()
  const fencePattern = /^\s{0,3}(?:`{3,}|~{3,})\s*([^\s`~]+)/gm
  let match
  while ((match = fencePattern.exec(text)) !== null) {
    languages.add(match[1])
  }
  await Promise.all([...languages].map(loadHighlightLanguage))
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    const language = normalizeHighlightLanguage(lang || '')
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language }).value}</code></pre>`
      } catch (_) {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

// Block formulas must be parsed as block tokens. Rendering a <div> from an
// inline token creates invalid <p><div>...</div></p> markup and breaks preview
// block measurement in the virtual scroller.
md.block.ruler.before('fence', 'math_block', function (state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  const openingLine = state.src.slice(start, max)

  if (!openingLine.startsWith('$$')) return false

  const firstContent = openingLine.slice(2)
  let closeIndex = firstContent.indexOf('$$')

  // A closing marker on the opening line must be the final non-space content.
  if (closeIndex >= 0 && firstContent.slice(closeIndex + 2).trim()) return false
  if (silent) return true

  const contentLines = []
  let nextLine = startLine

  if (closeIndex >= 0) {
    contentLines.push(firstContent.slice(0, closeIndex))
  } else {
    contentLines.push(firstContent)
    let foundClose = false

    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
      const line = state.src.slice(lineStart, lineEnd)
      closeIndex = line.indexOf('$$')

      if (closeIndex >= 0 && !line.slice(closeIndex + 2).trim()) {
        contentLines.push(line.slice(0, closeIndex))
        foundClose = true
        break
      }

      contentLines.push(line)
    }

    if (!foundClose) return false
  }

  state.line = nextLine + 1
  const token = state.push('math_block', '', 0)
  token.block = true
  token.map = [startLine, state.line]
  token.content = contentLines.join('\n').trim()
  token.markup = '$$'
  return true
})

// KaTeX inline math rendering plugin for markdown-it
md.inline.ruler.after('escape', 'math_inline', function (state, silent) {
  const start = state.pos
  const max = state.posMax

  if (state.src.charCodeAt(start) !== 36 /* $ */) return false
  if (state.src.charCodeAt(start + 1) === 36) return false // Block delimiter
  if (/\s/.test(state.src[start + 1] || '')) return false

  let pos = start + 1
  while (pos < max) {
    if (state.src.charCodeAt(pos) === 36) {
      if (state.src.charCodeAt(pos + 1) === 36 || /\s/.test(state.src[pos - 1] || '')) {
        pos++
        continue
      }
      if (!silent) {
        const token = state.push('math_inline', '', 0)
        token.content = state.src.slice(start + 1, pos)
        token.markup = '$'
      }
      state.pos = pos + 1
      return true
    }
    if (state.src.charCodeAt(pos) === 92 /* \ */) pos++
    pos++
  }
  return false
})

md.renderer.rules.math_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: false })
  } catch {
    return `<code>${md.utils.escapeHtml(tokens[idx].content)}</code>`
  }
}

md.renderer.rules.math_block = (tokens, idx) => {
  try {
    return `<div class="math-block">${katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })}</div>\n`
  } catch {
    return `<div class="math-block"><code>${md.utils.escapeHtml(tokens[idx].content)}</code></div>\n`
  }
}

// Keep wide tables readable in narrow split panes without forcing the entire
// preview to scroll horizontally.
md.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

export function renderMarkdown(text, basePath = '') {
  return renderMarkdownWithAssets(text, basePath)
}

function renderMarkdownWithAssets(text, basePath = '') {
  const fullHtml = md.render(text)
  const container = document.createElement('div')
  container.innerHTML = fullHtml
  rewriteAssetSources(container, basePath)
  return container.innerHTML
}

function rewriteAssetSources(container, basePath) {
  const images = container.querySelectorAll('img[src]')
  images.forEach((img) => {
    let rawSrc = img.getAttribute('src') || ''
    // markdown-it URL-encodes backslashes (%5C) and other special characters.
    // Decode so Windows paths like F:\images\photo.png are recognized by
    // resolveMarkdownAssetSrc instead of being mistaken for remote URLs.
    try {
      rawSrc = decodeURIComponent(rawSrc)
    } catch {
      // Keep original if decoding fails (malformed encoding)
    }
    const resolvedSrc = resolveMarkdownAssetSrc(rawSrc, basePath)
    if (resolvedSrc && resolvedSrc !== rawSrc) {
      img.setAttribute('src', resolvedSrc)
    }
  })
}

export function renderToBlocks(text, basePath = '') {
  const fullHtml = renderMarkdownWithAssets(text, basePath)
  const container = document.createElement('div')
  container.innerHTML = fullHtml

  const blocks = []
  for (const child of container.children) {
    blocks.push({
      html: child.outerHTML,
      tag: child.tagName.toLowerCase(),
      estimatedHeight: estimateHeight(child),
      measuredHeight: null,
    })
  }

  return blocks
}

function estimateHeight(el) {
  const tag = el.tagName.toLowerCase()
  const text = el.textContent || ''

  if (el.querySelector('img')) {
    const imageCount = el.querySelectorAll('img').length
    return 280 + (imageCount - 1) * 48
  }

  if (tag.match(/^h[1-6]$/)) {
    const level = parseInt(tag[1])
    return 40 - level * 4 + 16
  }

  if (tag === 'pre') {
    const lines = text.split('\n').length
    return lines * 20 + 24
  }

  if (tag === 'blockquote') {
    const lines = text.split('\n').length
    return lines * 24 + 16
  }

  if (tag === 'ul' || tag === 'ol') {
    return el.children.length * 28 + 8
  }

  if (tag === 'table' || el.querySelector('table')) {
    const rows = el.querySelectorAll('tr').length
    return rows * 42 + 18
  }

  if (tag === 'hr') {
    return 24
  }

  const lines = Math.ceil(text.length / 80) || 1
  return lines * 24 + 12
}
