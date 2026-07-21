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

function isSelectionInside(cursor, from, to) {
  return cursor.from > from && cursor.to < to
}

export function removeOverlappingDecorations(decorations, from, to) {
  let writeIndex = 0
  let removed = 0

  for (const decoration of decorations) {
    const hasWidth = decoration.from < decoration.to
    const overlaps = hasWidth && decoration.from < to && decoration.to > from
    if (overlaps) {
      removed++
    } else {
      decorations[writeIndex++] = decoration
    }
  }

  decorations.length = writeIndex
  return removed
}

function parseLinePrefix(text) {
  let index = 0
  while (text[index] === ' ' || text[index] === '\t') index++

  const indentEnd = index
  let quoteDepth = 0
  while (text[index] === '>') {
    quoteDepth++
    index++
    while (text[index] === ' ' || text[index] === '\t') index++
  }

  return { indentEnd, prefixEnd: index, quoteDepth }
}

function findClosingDoubleDollar(text) {
  let searchFrom = 0
  while (searchFrom < text.length) {
    const index = text.indexOf('$$', searchFrom)
    if (index < 0) return -1
    if (!text.slice(index + 2).trim()) return index
    searchFrom = index + 2
  }
  return -1
}

function findBlockMathDecorations(view, cursor) {
  const decorations = []
  const doc = view.state.doc
  const visitedLines = new Set()

  for (const visibleRange of view.visibleRanges) {
    const firstLine = doc.lineAt(visibleRange.from).number
    const lastLine = doc.lineAt(Math.min(visibleRange.to, doc.length)).number

    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
      if (visitedLines.has(lineNumber)) continue
      visitedLines.add(lineNumber)

      const openingLine = doc.line(lineNumber)
      const openingPrefix = parseLinePrefix(openingLine.text)
      const openingText = openingLine.text.slice(openingPrefix.prefixEnd)
      if (!openingText.startsWith('$$')) continue

      const sourceFrom = openingLine.from + openingPrefix.prefixEnd
      if (isInsideCode(view, sourceFrom)) continue

      const firstContent = openingText.slice(2)
      const sameLineClose = findClosingDoubleDollar(firstContent)

      if (sameLineClose >= 0) {
        const sourceTo = sourceFrom + 2 + sameLineClose + 2
        if (!isSelectionInside(cursor, sourceFrom, sourceTo)) {
          decorations.push({
            from: sourceFrom,
            to: sourceTo,
            widget: new BlockMathWidget(firstContent.slice(0, sameLineClose).trim()),
          })
        }
        continue
      }

      const texLines = [firstContent]
      const continuationLines = []
      let sourceTo = -1

      for (let nextNumber = lineNumber + 1; nextNumber <= doc.lines; nextNumber++) {
        const line = doc.line(nextNumber)
        const prefix = parseLinePrefix(line.text)
        let formulaText = line.text
        let contentFrom = line.from

        if (openingPrefix.quoteDepth > 0) {
          if (prefix.quoteDepth !== openingPrefix.quoteDepth) break
          formulaText = line.text.slice(prefix.prefixEnd)
          contentFrom = line.from + prefix.prefixEnd
        } else if (prefix.quoteDepth > 0) {
          break
        }

        const close = findClosingDoubleDollar(formulaText)
        if (close >= 0) {
          texLines.push(formulaText.slice(0, close))
          sourceTo = contentFrom + close + 2
          continuationLines.push({ line, from: contentFrom, to: sourceTo })
          break
        }

        texLines.push(formulaText)
        continuationLines.push({ line, from: contentFrom, to: line.to })
      }

      if (sourceTo < 0 || isSelectionInside(cursor, sourceFrom, sourceTo)) continue

      decorations.push({
        from: sourceFrom,
        to: openingLine.to,
        widget: new BlockMathWidget(texLines.join('\n').trim()),
      })

      for (const continuation of continuationLines) {
        if (continuation.to > continuation.from) {
          decorations.push({
            from: continuation.from,
            to: continuation.to,
            widget: null,
          })
        }
        decorations.push({
          from: continuation.line.from,
          to: continuation.line.from,
          lineClass: 'cm-wysiwyg-math-hidden-line',
        })
      }
    }
  }

  return decorations
}

export function findMathDecorations(view, cursor) {
  const decorations = findBlockMathDecorations(view, cursor)

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let match

    // Inline math: $...$ (not $)
    const inlineRegex = /(?<![\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      if (!isSelectionInside(cursor, start, end)) {
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
