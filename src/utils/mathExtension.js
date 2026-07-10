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
    const div = document.createElement('span')
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

function isInsideCode(view, pos) {
  let node = syntaxTree(view.state).resolveInner(pos, 1)
  while (node) {
    if (node.type.name === 'FencedCode' || node.type.name === 'InlineCode' ||
        node.type.name === 'CodeBlock' || node.type.name === 'CodeText') {
      return true
    }
    node = node.parent
  }
  return false
}

export function findMathDecorations(view, cursor) {
  const decorations = []

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Block math: $$...$$
    const blockRegex = /^[ \t]*\$\$([\s\S]+?)\$\$[ \t]*$/gm
    let match
    while ((match = blockRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      if (isInsideCode(view, start)) continue
      // Treat a cursor on either boundary as active so clicking a rendered
      // formula reveals its source and makes it editable.
      if (cursor.to < start || cursor.from > end) {
        const startLine = view.state.doc.lineAt(start)
        const endLine = view.state.doc.lineAt(end)
        decorations.push({
          from: start,
          to: startLine.number === endLine.number ? end : startLine.to,
          widget: new BlockMathWidget(match[1].trim()),
        })

        // Plugin decorations cannot replace line breaks. Hide the remaining
        // source line by line and collapse those lines instead.
        for (let lineNumber = startLine.number + 1; lineNumber <= endLine.number; lineNumber++) {
          const line = view.state.doc.line(lineNumber)
          const hideTo = lineNumber === endLine.number ? end : line.to
          if (hideTo > line.from) {
            decorations.push({
              from: line.from,
              to: hideTo,
              widget: null,
            })
          }
          decorations.push({
            from: line.from,
            to: line.from,
            lineClass: 'cm-wysiwyg-math-hidden-line',
          })
        }
      }
    }

    // Inline math: $...$ (not $)
    const inlineRegex = /(?<![\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      if (cursor.to < start || cursor.from > end) {
        if (!isInsideCode(view, start)) {
          decorations.push({
            from: start,
            to: end,
            widget: new InlineMathWidget(match[1]),
          })
        }
      }
    }
  }

  return decorations
}
