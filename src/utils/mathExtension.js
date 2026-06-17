import { WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import katex from 'katex'

class InlineMathWidget extends WidgetType {
  constructor(tex) {
    super()
    this.tex = tex
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-math-inline'
    try {
      katex.render(this.tex, span, { throwOnError: false, displayMode: false })
    } catch {
      span.textContent = this.tex
    }
    return span
  }
  ignoreEvent() { return false }
}

class BlockMathWidget extends WidgetType {
  constructor(tex) {
    super()
    this.tex = tex
  }
  toDOM() {
    const div = document.createElement('div')
    div.className = 'cm-wysiwyg-math-block'
    try {
      katex.render(this.tex, div, { throwOnError: false, displayMode: true })
    } catch {
      div.textContent = this.tex
    }
    return div
  }
  ignoreEvent() { return false }
}

export function findMathDecorations(view, cursor) {
  const decorations = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Block math: $$...$$
    const blockRegex = /\$\$([\s\S]+?)\$\$/g
    let match
    while ((match = blockRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      // Show rendered math unless cursor is strictly inside the formula range
      if (cursor.to <= start || cursor.from >= end) {
        decorations.push({
          from: start,
          to: end,
          widget: new BlockMathWidget(match[1].trim()),
          block: true,
        })
      }
    }

    // Inline math: $...$ (not $)
    const inlineRegex = /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      // Show rendered math unless cursor is strictly inside the formula range
      if (cursor.to <= start || cursor.from >= end) {
        let insideCode = false
        syntaxTree(view.state).iterate({
          from: start,
          to: end,
          enter(node) {
            if (node.type.name === 'FencedCode' || node.type.name === 'InlineCode' ||
                node.type.name === 'CodeBlock' || node.type.name === 'CodeText') {
              insideCode = true
              return false
            }
          }
        })
        if (!insideCode) {
          decorations.push({
            from: start,
            to: end,
            widget: new InlineMathWidget(match[1]),
            block: false,
          })
        }
      }
    }
  }

  return decorations
}