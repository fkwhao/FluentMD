import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { findMathDecorations, removeOverlappingDecorations } from '@/utils/mathExtension'
import { resolveMarkdownAssetSrc } from '@/utils/assetUrls'

// ── Performance thresholds ──────────────────────────────────────────────
const LARGE_DOC_CHARS = 100000
const LARGE_DOC_LINES = 3000
const HUGE_DOC_CHARS = 300000
const HUGE_DOC_LINES = 10000
const MAX_DECORATIONS = 5000

// ── Widgets ─────────────────────────────────────────────────────────────

class ImageWidget extends WidgetType {
  constructor(src, alt, getBasePath) {
    super()
    this.src = src
    this.alt = alt
    this.getBasePath = getBasePath
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-wysiwyg-image'

    const img = document.createElement('img')
    const normalizedSrc = (this.src || '').replace(/\\/g, '/')
    img.src = resolveMarkdownAssetSrc(normalizedSrc, this.getBasePath?.() || '')
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    img.style.display = 'block'
    img.setAttribute('data-raw-src', this.src || '')

    img.onerror = () => {
      wrap.innerHTML = ''
      const placeholder = document.createElement('span')
      placeholder.className = 'cm-wysiwyg-image-placeholder'
      placeholder.textContent = `[Image: ${this.alt || this.src || 'unknown'}]`
      placeholder.style.cssText =
        'display:inline-block;padding:8px 12px;background:var(--preview-code-bg);border-radius:4px;' +
        'color:var(--preview-blockquote-fg);font-size:0.9em;border:1px dashed var(--preview-table-border);'
      wrap.appendChild(placeholder)
    }

    wrap.appendChild(img)
    return wrap
  }

  ignoreEvent() {
    return false
  }
}

class HrWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-hr'
    return span
  }

  ignoreEvent() {
    return false
  }
}

class ListBulletWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }

  toDOM() {
    const span = document.createElement('span')
    const marker = this.text.trim()
    span.textContent = /^\d+\.$/.test(marker) ? `${marker} ` : '• '
    span.className = 'cm-wysiwyg-list-mark'
    return span
  }

  ignoreEvent() {
    return false
  }
}

class CodeLangWidget extends WidgetType {
  constructor(lang) {
    super()
    this.lang = lang
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-wysiwyg-code-lang'
    span.textContent = this.lang || '选择语言'
    span.setAttribute('data-code-lang', 'true')
    if (!this.lang) span.classList.add('cm-wysiwyg-code-lang-placeholder')
    return span
  }

  ignoreEvent() {
    return false
  }
}

// ── Shared helpers ──────────────────────────────────────────────────────

/**
 * For large documents we never hide decorations — treating cursor as always
 * outside every token avoids expensive rebuilds on selection changes.
 */
function isCursorInside(cursor, node, isLargeDoc) {
  if (isLargeDoc) return false
  return cursor.from >= node.from && cursor.to <= node.to
}

function isLineVisible(lineFrom, lineTo, visibleRanges) {
  for (const { from, to } of visibleRanges) {
    if (lineFrom <= to && lineTo >= from) return true
  }
  return false
}

// ── Image fallback scanning ─────────────────────────────────────────────

function findImageFallbacks(view, cursor, getBasePath) {
  const results = []
  const tree = syntaxTree(view.state)

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    const imgRegex = /!\[([^\]]*)\]\(([^)]*)\)/g
    let match
    while ((match = imgRegex.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length

      if (cursor.from >= start && cursor.to <= end) continue

      let alreadyCovered = false
      tree.iterate({
        from: start,
        to: end,
        enter(node) {
          if (node.type.name === 'Image' && node.from <= start && node.to >= end) {
            alreadyCovered = true
            return false
          }
          if (node.type.name === 'FencedCode' || node.type.name === 'InlineCode') {
            alreadyCovered = true
            return false
          }
        },
      })
      if (alreadyCovered) continue

      results.push({
        from: start,
        to: end,
        alt: match[1],
        url: match[2].trim(),
      })
    }
  }

  return results
}

// ── Decoration builder ──────────────────────────────────────────────────

/**
 * @param {EditorView} view
 * @param {() => string} getBasePath
 * @param {{ columnWidths: Map<number,{widths:number[],maxWidth:number}>, cellMap: Map<number,{colIdx:number,tableFrom:number}> }} tableCache
 */
function buildDecorations(view, getBasePath = () => '', tableCache = null) {
  const decorationErrors = []
  try {
    const widgets = []
    const cursor = view.state.selection.main
    const docLength = view.state.doc.length
    const docLines = view.state.doc.lines

    const isLargeDoc = docLength > LARGE_DOC_CHARS || docLines > LARGE_DOC_LINES
    const isHugeDoc = docLength > HUGE_DOC_CHARS || docLines > HUGE_DOC_LINES

    // Shared mutable caches (keyed by table start position)
    const tableColumnWidths = tableCache?.columnWidths || new Map()
    const cellColumnMap = tableCache?.cellMap || new Map()
    const blockquoteLines = new Map()

    let decoCount = 0
    const decoLimit = isHugeDoc ? Math.floor(MAX_DECORATIONS / 3) : MAX_DECORATIONS

    // Helpers for decoration accounting
    function pushDeco(w, expensive = false) {
      if (expensive && decoCount >= decoLimit) return false
      widgets.push(w)
      decoCount++
      return true
    }

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter(node) {
          try {
            const cursorInside = isCursorInside(cursor, node, isLargeDoc)

            switch (node.type.name) {
            case 'ATXHeading1':
            case 'ATXHeading2':
            case 'ATXHeading3':
            case 'ATXHeading4':
            case 'ATXHeading5':
            case 'ATXHeading6': {
              const line = view.state.doc.lineAt(node.from)
              pushDeco({
                from: line.from,
                to: line.from,
                deco: Decoration.line({
                  class: `cm-wysiwyg-heading cm-wysiwyg-${node.type.name}`,
                }),
              })
              const headEnd = line.to
              pushDeco({
                from: node.from,
                to: Math.min(node.to, headEnd),
                deco: Decoration.mark({
                  attributes: { style: 'color:inherit' },
                }),
              })
              break
            }

            case 'HeaderMark': {
              if (!cursorInside) {
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
              break
            }

            case 'EmphasisMark': {
              const parent = node.node.parent
              const parentActive = !isLargeDoc && parent &&
                cursor.from >= parent.from && cursor.to <= parent.to
              if (!parentActive) {
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
                if (parent && node.from === parent.from) {
                  const isStrong = parent.type.name === 'StrongEmphasis'
                  const contentFrom = node.to
                  const contentTo = parent.lastChild ? parent.lastChild.node.from : parent.to
                  if (contentTo > contentFrom) {
                    pushDeco({
                      from: contentFrom,
                      to: contentTo,
                      deco: Decoration.mark({
                        attributes: {
                          style: isStrong ? 'font-weight:700' : 'font-style:italic',
                        },
                      }),
                    })
                  }
                }
              }
              break
            }

            case 'StrikethroughMark': {
              const parent = node.node.parent
              const parentActive = !isLargeDoc && parent &&
                cursor.from >= parent.from && cursor.to <= parent.to
              if (!parentActive) {
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
                if (parent && node.from === parent.from) {
                  const contentFrom = node.to
                  const contentTo = parent.lastChild ? parent.lastChild.node.from : parent.to
                  if (contentTo > contentFrom) {
                    pushDeco({
                      from: contentFrom,
                      to: contentTo,
                      deco: Decoration.mark({
                        attributes: { style: 'text-decoration:line-through' },
                      }),
                    })
                  }
                }
              }
              break
            }

            case 'InlineCode': {
              if (!cursorInside) {
                const text = view.state.doc.sliceString(node.from, node.to)
                if (text.startsWith('`') && text.endsWith('`')) {
                  pushDeco({ from: node.from, to: node.from + 1, deco: Decoration.replace({}) })
                  pushDeco({ from: node.to - 1, to: node.to, deco: Decoration.replace({}) })
                  pushDeco({
                    from: node.from + 1,
                    to: node.to - 1,
                    deco: Decoration.mark({
                      class: 'cm-wysiwyg-inline-code',
                    }),
                  })
                }
              }
              break
            }

            case 'FencedCode': {
              const codeBlockActive = cursor.from >= node.from && cursor.to <= node.to
              const firstLine = view.state.doc.lineAt(node.from)
              const lastLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1))
              let pos = firstLine.from

              // Only decorate lines that intersect the current visible ranges
              while (pos <= node.to) {
                const line = view.state.doc.lineAt(pos)
                const lineEnd = line.to
                if (isLineVisible(line.from, lineEnd, view.visibleRanges)) {
                  const classes = ['cm-wysiwyg-code-block']
                  if (line.from === firstLine.from) classes.push('cm-wysiwyg-code-first')
                  if (line.from === lastLine.from) classes.push('cm-wysiwyg-code-last')
                  pushDeco({
                    from: line.from,
                    to: line.from,
                    deco: Decoration.line({
                      class: classes.join(' '),
                    }),
                  })
                }
                pos = lineEnd + 1
                if (pos > view.state.doc.length) break
              }

              if (!codeBlockActive) {
                try {
                  let hasCodeInfo = false
                  const firstLineTo = view.state.doc.lineAt(node.from).to
                  if (node.node) {
                    for (let child = node.node.firstChild; child; child = child.nextSibling) {
                      if (child.type.name === 'CodeInfo') {
                        hasCodeInfo = true
                        break
                      }
                      if (child.from > firstLineTo) break
                    }
                  }

                  if (!hasCodeInfo) {
                    let insertPos = node.from
                    if (node.node) {
                      for (let child = node.node.firstChild; child; child = child.nextSibling) {
                        if (child.type.name === 'CodeMark') {
                          insertPos = child.to
                          break
                        }
                      }
                    }

                    pushDeco({
                      from: insertPos,
                      to: insertPos,
                      deco: Decoration.widget({ widget: new CodeLangWidget(''), side: 1 }),
                    })
                  }
                } catch {
                  // Skip language label when tree traversal fails.
                }
              }
              break
            }

            case 'CodeMark': {
              if (!cursorInside) {
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
              break
            }

            case 'CodeInfo': {
              if (!cursorInside) {
                const lang = view.state.doc.sliceString(node.from, node.to)
                pushDeco({
                  from: node.from,
                  to: node.to,
                  deco: Decoration.replace({ widget: new CodeLangWidget(lang) }),
                })
              }
              break
            }

            case 'Link': {
              if (!cursorInside) {
                const text = view.state.doc.sliceString(node.from, node.to)
                const match = text.match(/^\[([^\]]*)\]\(([^)]*)\)$/)
                if (match) {
                  const linkTextStart = node.from + 1
                  const linkTextEnd = node.from + 1 + match[1].length
                  pushDeco({ from: node.from, to: linkTextStart, deco: Decoration.replace({}) })
                  pushDeco({ from: linkTextEnd, to: node.to, deco: Decoration.replace({}) })
                  pushDeco({
                    from: linkTextStart,
                    to: linkTextEnd,
                    deco: Decoration.mark({
                      class: 'cm-wysiwyg-link',
                      attributes: {
                        style: 'color:var(--preview-link);text-decoration:underline',
                        title: match[2],
                      },
                    }),
                  })
                }
              }
              break
            }

            case 'Image': {
              // Respect the global decoration limit (set by pushDeco) for
              // expensive widgets, but don't skip entirely for large docs.
              const imageActive = !isLargeDoc &&
                cursor.from >= node.from && cursor.to <= node.to
              if (!imageActive) {
                const text = view.state.doc.sliceString(node.from, node.to)
                const altStart = text.indexOf('![')
                const urlMarker = text.indexOf('](', altStart !== -1 ? altStart + 2 : 0)
                if (altStart !== -1 && urlMarker !== -1) {
                  const alt = text.slice(altStart + 2, urlMarker)
                  let urlPart = text.slice(urlMarker + 2)
                  const lastParen = urlPart.lastIndexOf(')')
                  if (lastParen !== -1) {
                    urlPart = urlPart.slice(0, lastParen)
                  }
                  const titleMatch = urlPart.match(/\s+("[^"]*"|'[^']*'|\([^)]*\))$/)
                  if (titleMatch) {
                    urlPart = urlPart.slice(0, urlPart.length - titleMatch[0].length)
                  }
                  const url = urlPart.trim()
                  if (url) {
                    pushDeco({
                      from: node.from,
                      to: node.to,
                      deco: Decoration.replace({
                        widget: new ImageWidget(url, alt, getBasePath),
                      }),
                    }, /* expensive */ true)
                  }
                }
              }
              break
            }

            case 'QuoteMark': {
              if (!cursorInside) {
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
              break
            }

            case 'Blockquote': {
              const firstLine = view.state.doc.lineAt(node.from)
              const lastLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1))
              let depth = 1
              for (let parent = node.node.parent; parent; parent = parent.parent) {
                if (parent.type.name === 'Blockquote') depth++
              }

              let pos = firstLine.from
              while (pos <= node.to) {
                const line = view.state.doc.lineAt(pos)
                const lineEnd = line.to
                if (isLineVisible(line.from, lineEnd, view.visibleRanges)) {
                  const current = blockquoteLines.get(line.from) || {
                    depth: 0,
                    first: false,
                    last: false,
                  }
                  current.depth = Math.max(current.depth, depth)
                  current.first ||= line.from === firstLine.from
                  current.last ||= line.from === lastLine.from
                  blockquoteLines.set(line.from, current)
                }
                pos = lineEnd + 1
                if (pos > view.state.doc.length) break
              }
              break
            }

            case 'HorizontalRule': {
              if (!cursorInside) {
                pushDeco({
                  from: node.from,
                  to: node.to,
                  deco: Decoration.replace({ widget: new HrWidget() }),
                })
              }
              break
            }

            case 'ListMark': {
              if (!cursorInside) {
                const markText = view.state.doc.sliceString(node.from, node.to)
                pushDeco({
                  from: node.from,
                  to: node.to,
                  deco: Decoration.replace({ widget: new ListBulletWidget(markText) }),
                })
              }
              break
            }

            case 'Table': {
              // Compute column widths only once per table (cached across calls)
              if (!tableColumnWidths.has(node.from)) {
                try {
                  const columnWidths = []
                  for (let row = node.node.firstChild; row; row = row.nextSibling) {
                    if (row.type.name !== 'TableHeader' && row.type.name !== 'TableRow') continue
                    let colIdx = 0
                    for (let cell = row.firstChild; cell; cell = cell.nextSibling) {
                      if (cell.type.name !== 'TableCell') continue
                      const cellText = view.state.doc.sliceString(cell.from, cell.to)
                      const contentLen = cellText.trim().length
                      if (columnWidths.length <= colIdx) {
                        columnWidths.push(contentLen)
                      } else if (contentLen > columnWidths[colIdx]) {
                        columnWidths[colIdx] = contentLen
                      }
                      cellColumnMap.set(cell.from, { colIdx, tableFrom: node.from })
                      colIdx++
                    }
                  }
                  // Store column count and widths for percentage-based equal-width columns
                  tableColumnWidths.set(node.from, { widths: columnWidths, colCount: columnWidths.length })
                } catch (e) {
                  decorationErrors.push({ type: 'Table/colWidth', from: node.from, error: e.message })
                }
              }
              break
            }

            case 'TableHeader': {
              const lineFrom = view.state.doc.lineAt(node.from).from
              pushDeco({
                from: lineFrom,
                to: lineFrom,
                deco: Decoration.line({
                  class: 'cm-wysiwyg-table-line cm-wysiwyg-table-header cm-wysiwyg-table-first',
                }),
              })
              pushDeco({
                from: node.from,
                to: node.to,
                deco: Decoration.mark({
                  attributes: { style: 'font-weight:600;color:inherit' },
                }),
              })
              break
            }

            case 'TableRow': {
              const lineFrom = view.state.doc.lineAt(node.from).from
              let rowIndex = 0
              let hasFollowingRow = false
              for (let sibling = node.node.prevSibling; sibling; sibling = sibling.prevSibling) {
                if (sibling.type.name === 'TableRow') rowIndex++
              }
              for (let sibling = node.node.nextSibling; sibling; sibling = sibling.nextSibling) {
                if (sibling.type.name === 'TableRow') {
                  hasFollowingRow = true
                  break
                }
              }
              const rowClasses = ['cm-wysiwyg-table-line', 'cm-wysiwyg-table-row']
              if (rowIndex % 2 === 1) rowClasses.push('cm-wysiwyg-table-row-alt')
              if (!hasFollowingRow) rowClasses.push('cm-wysiwyg-table-last')
              pushDeco({
                from: lineFrom,
                to: lineFrom,
                deco: Decoration.line({
                  class: rowClasses.join(' '),
                }),
              })
              break
            }

            case 'TableCell': {
              // Equal column widths via percentage — include whitespace around
              // cell content so the columns add up to exactly 100% after the
              // pipe delimiters are hidden.
              let colStyle = 'padding:0 14px;color:inherit;display:inline-block;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;vertical-align:top'
              const colInfo = cellColumnMap.get(node.from)
              if (colInfo) {
                const tableData = tableColumnWidths.get(colInfo.tableFrom)
                if (tableData && tableData.colCount > 0) {
                  colStyle += `;width:${(100 / tableData.colCount).toFixed(4)}%`
                }
              }

              const previous = node.node.prevSibling
              const next = node.node.nextSibling
              const cellFrom = previous?.type.name === 'TableDelimiter' ? previous.to : node.from
              const cellTo = next?.type.name === 'TableDelimiter' ? next.from : node.to
              pushDeco({
                from: cellFrom,
                to: cellTo,
                deco: Decoration.mark({
                  attributes: { style: colStyle },
                }),
              })
              break
            }

            case 'TableDelimiter': {
              const text = view.state.doc.sliceString(node.from, node.to)
              if (text.includes('-')) {
                if (!cursorInside) {
                  const line = view.state.doc.lineAt(node.from)
                  pushDeco({
                    from: line.from,
                    to: line.from,
                    deco: Decoration.line({
                      class: 'cm-wysiwyg-table-line cm-wysiwyg-table-delimiter',
                    }),
                  })
                  pushDeco({ from: line.from, to: line.to, deco: Decoration.replace({}) })
                }
              } else {
                // Keep row layout stable while editing a cell by hiding pipe
                // markers consistently, including the marker at the cursor.
                pushDeco({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              }
              break
            }
          }
          } catch (e) {
            decorationErrors.push({ type: node.type.name, from: node.from, error: e.message })
          }
          },
        })
    }

    for (const [lineFrom, quote] of blockquoteLines) {
      const classes = [
        'cm-wysiwyg-blockquote',
        `cm-wysiwyg-blockquote-depth-${Math.min(quote.depth, 3)}`,
      ]
      if (quote.first) classes.push('cm-wysiwyg-blockquote-first')
      if (quote.last) classes.push('cm-wysiwyg-blockquote-last')
      pushDeco({
        from: lineFrom,
        to: lineFrom,
        deco: Decoration.line({ class: classes.join(' ') }),
      })
    }

    if (decorationErrors.length > 0) {
      console.warn('WYSIWYG decoration errors:', decorationErrors.length, decorationErrors.slice(0, 5))
    }

    // Image fallback scanning — skip for large docs (regex scan over visible text is expensive)
    if (!isLargeDoc) {
      const imageFallbacks = findImageFallbacks(view, cursor, getBasePath)
      for (const fb of imageFallbacks) {
        pushDeco({
          from: fb.from,
          to: fb.to,
          deco: Decoration.replace({
            widget: new ImageWidget(fb.url, fb.alt, getBasePath),
          }),
        }, /* expensive */ true)
      }
    }

    // Math uses a cached document index and only renders visible formulas.
    // Keep math enabled for large documents instead of showing raw TeX.
    const mathDecos = findMathDecorations(view, cursor)
    for (const m of mathDecos) {
      if (!m.lineClass && m.to > m.from) {
        decoCount -= removeOverlappingDecorations(widgets, m.from, m.to)
      }
      pushDeco({
        from: m.from,
        to: m.to,
        deco: m.lineClass
          ? Decoration.line({ class: m.lineClass })
          : Decoration.replace(m.widget ? { widget: m.widget } : {}),
      })
    }

    widgets.sort((a, b) => a.from - b.from || a.to - b.to)

    const builder = new RangeSetBuilder()
    for (const w of widgets) {
      try {
        builder.add(w.from, w.to, w.deco)
      } catch {
        // Skip overlapping or invalid ranges.
      }
    }

    return builder.finish()
  } catch (e) {
    console.error('WYSIWYG decoration error:', e)
    return Decoration.none
  }
}

// ── Plugin ──────────────────────────────────────────────────────────────

export function createWysiwygPlugin(getBasePath = () => '') {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.tableCache = { columnWidths: new Map(), cellMap: new Map() }
      this.isLargeDoc = false
      this.decorations = buildDecorations(view, getBasePath, this.tableCache)
    }

    update(update) {
      const doc = update.view.state.doc
      const isLarge = doc.length > LARGE_DOC_CHARS || doc.lines > LARGE_DOC_LINES

      if (update.docChanged) {
        // Invalidate table cache — document content changed
        this.tableCache.columnWidths.clear()
        this.tableCache.cellMap.clear()
        this.decorations = buildDecorations(update.view, getBasePath, this.tableCache)
      } else if (update.viewportChanged) {
        this.decorations = buildDecorations(update.view, getBasePath, this.tableCache)
      } else if (update.selectionSet && !this.isLargeDoc) {
        // For small/medium docs, rebuild on cursor move (needed for cursorInside hide).
        // For large docs, skip — cursorInside is always false so decorations are stable.
        this.decorations = buildDecorations(update.view, getBasePath, this.tableCache)
      }

      this.isLargeDoc = isLarge
    }
  }, {
    decorations: (v) => v.decorations,
  })
}

export const wysiwygPlugin = createWysiwygPlugin()

export const wysiwygTheme = EditorView.theme({
  '.cm-wysiwyg-code-block': {},
  '.cm-wysiwyg-image': { display: 'block', width: '100%' },
  '.cm-wysiwyg-image img': { maxWidth: '100%', borderRadius: '4px' },
  '.cm-wysiwyg-hr': { border: 'none', borderTop: '1px solid var(--toolbar-border)', margin: '0.5em 0', display: 'block', width: '100%' },
  '.cm-wysiwyg-list-mark': { color: 'var(--editor-fg)', opacity: '0.5' },
  '.cm-wysiwyg-code-lang': {
    opacity: '0.5',
    fontSize: '0.85em',
    cursor: 'pointer',
    padding: '1px 6px',
    borderRadius: '3px',
    transition: 'opacity 0.15s, background-color 0.15s',
  },
  '.cm-wysiwyg-code-lang:hover': {
    opacity: '0.8',
    backgroundColor: 'var(--menu-hover)',
  },
  '.cm-wysiwyg-code-lang-placeholder': {
    fontStyle: 'italic',
    opacity: '0.35',
  },
  '.cm-wysiwyg-table-line': {
    borderLeft: '1px solid var(--preview-table-border)',
    borderRight: '1px solid var(--preview-table-border)',
    padding: '2px 8px',
  },
  '.cm-wysiwyg-table-first': {
    borderTop: '1px solid var(--preview-table-border)',
  },
  '.cm-wysiwyg-table-header': {
    backgroundColor: 'var(--preview-table-header-bg)',
    borderBottom: '2px solid var(--preview-table-border)',
  },
  '.cm-wysiwyg-table-row': {
    borderBottom: '1px solid var(--preview-table-border)',
  },
  '.cm-wysiwyg-table-delimiter': {
    lineHeight: '0',
    padding: '0',
    height: '2px',
  },
  '.cm-wysiwyg-blockquote': {
    color: 'var(--preview-blockquote-fg)',
    paddingLeft: '18px',
    borderLeft: '3px solid var(--preview-blockquote-border)',
    backgroundColor: 'var(--blockquote-bg)',
  },
  '.cm-wysiwyg-math-inline': {
    cursor: 'pointer',
    padding: '1px 4px',
    borderRadius: '3px',
    backgroundColor: 'var(--accent-light)',
  },
  '.cm-wysiwyg-math-block': {
    display: 'block',
    cursor: 'pointer',
    padding: '12px 16px',
    margin: '8px 0',
    borderRadius: '4px',
    backgroundColor: 'var(--accent-light)',
    textAlign: 'center',
    overflowX: 'auto',
  },
  '.cm-wysiwyg-math-hidden-line': {
    height: '0',
    lineHeight: '0',
    padding: '0',
  },
})
