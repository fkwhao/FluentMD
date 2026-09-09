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

const blockMathCache = new WeakMap()

function findBlockMathRanges(view) {
  const doc = view.state.doc
  const tree = syntaxTree(view.state)
  const cached = blockMathCache.get(doc)
  if (cached?.tree === tree) return cached.blocks
  const blocks = []
  let pending = null

  // Pair delimiters in document order, independently of the viewport and
  // cursor. Cache the index so scrolling/selection changes don't rescan text.
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber)
    const prefix = parseLinePrefix(line.text)

    if (pending) {
      let formulaText = line.text
      let contentFrom = line.from
      let sameContainer = true

      if (pending.quoteDepth > 0) {
        sameContainer = prefix.quoteDepth === pending.quoteDepth
        formulaText = line.text.slice(prefix.prefixEnd)
        contentFrom = line.from + prefix.prefixEnd
      } else if (prefix.quoteDepth > 0) {
        sameContainer = false
      }

      if (sameContainer) {
        const close = findClosingDoubleDollar(formulaText)
        if (close >= 0) {
          pending.texLines.push(formulaText.slice(0, close))
          const sourceTo = contentFrom + close + 2
          pending.continuationLines.push({ line, from: contentFrom, to: sourceTo })
          blocks.push({
            from: pending.from, to: sourceTo, openingTo: pending.openingTo,
            tex: pending.texLines.join('\n').trim(),
            continuationLines: pending.continuationLines,
          })
          pending = null
          continue
        }

        pending.texLines.push(formulaText)
        pending.continuationLines.push({ line, from: contentFrom, to: line.to })
        continue
      }

      // A quote boundary invalidates the unmatched opener. Reconsider this
      // same line below, since it may begin a new formula in its own container.
      pending = null
    }

    const openingText = line.text.slice(prefix.prefixEnd)
    if (!openingText.startsWith('$$')) continue

    const sourceFrom = line.from + prefix.prefixEnd
    if (isInsideCode(view, sourceFrom)) continue

    const firstContent = openingText.slice(2)
    const sameLineClose = findClosingDoubleDollar(firstContent)

    if (sameLineClose >= 0) {
      const sourceTo = sourceFrom + 2 + sameLineClose + 2
      blocks.push({
        from: sourceFrom, to: sourceTo, openingTo: sourceTo,
        tex: firstContent.slice(0, sameLineClose).trim(), continuationLines: [],
      })
    } else {
      pending = {
        from: sourceFrom,
        openingTo: line.to,
        quoteDepth: prefix.quoteDepth,
        texLines: [firstContent],
        continuationLines: [],
      }
    }
  }

  blockMathCache.set(doc, { tree, blocks })
  return blocks
}

function findBlockMathDecorations(view, cursor, blocks) {
  const decorations = []
  for (const block of blocks) {
    if (!view.visibleRanges.some(range => block.from <= range.to && block.to >= range.from)) continue
    if (isSelectionInside(cursor, block.from, block.to)) continue

    decorations.push({
      from: block.from,
      to: block.openingTo,
      widget: new BlockMathWidget(block.tex),
    })

    for (const continuation of block.continuationLines) {
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

  return decorations
}

export function findMathDecorations(view, cursor) {
  const blocks = findBlockMathRanges(view)
  const decorations = findBlockMathDecorations(view, cursor, blocks)

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let match

    // Inline math: $...$ (not $)
    const inlineRegex = /(?<![\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      if (blocks.some(block => start >= block.from && end <= block.to)) continue
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
