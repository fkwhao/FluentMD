import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

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

export function renderMarkdown(text) {
  return md.render(text)
}

export function renderToBlocks(text) {
  const fullHtml = md.render(text)
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
