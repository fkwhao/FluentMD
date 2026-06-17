import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import katex from 'katex'
import { resolveMarkdownAssetSrc } from '@/utils/assetUrls'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch (_) {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

// KaTeX math rendering plugin for markdown-it
md.inline.ruler.after('escape', 'math_inline', function (state, silent) {
  const start = state.pos
  const max = state.posMax

  // Block math $$...$$
  if (state.src.charCodeAt(start) === 36 /* $ */ && state.src.charCodeAt(start + 1) === 36) {
    let pos = start + 2
    while (pos < max - 1) {
      if (state.src.charCodeAt(pos) === 36 && state.src.charCodeAt(pos + 1) === 36) {
        if (!silent) {
          const token = state.push('math_block', '', 0)
          token.content = state.src.slice(start + 2, pos).trim()
          token.markup = '$$'
        }
        state.pos = pos + 2
        return true
      }
      if (state.src.charCodeAt(pos) === 92 /* \ */) pos++
      pos++
    }
    return false
  }

  // Inline math $...$
  if (state.src.charCodeAt(start) !== 36 /* $ */) return false
  if (start > 0 && state.src.charCodeAt(start - 1) === 36) return false // Skip $$

  let pos = start + 1
  while (pos < max) {
    if (state.src.charCodeAt(pos) === 36) {
      if (pos === start + 1) return false // Empty $$
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
    return `<div class="math-block">${katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })}</div>`
  } catch {
    return `<div class="math-block"><code>${md.utils.escapeHtml(tokens[idx].content)}</code></div>`
  }
}

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

  if (tag === 'table') {
    const rows = el.querySelectorAll('tr').length
    return rows * 32 + 16
  }

  if (tag === 'hr') {
    return 24
  }

  const lines = Math.ceil(text.length / 80) || 1
  return lines * 24 + 12
}
