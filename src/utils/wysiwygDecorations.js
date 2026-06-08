import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

class ImageWidget extends WidgetType {
  constructor(src, alt) {
    super()
    this.src = src
    this.alt = alt
  }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-wysiwyg-image'
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    wrap.appendChild(img)
    return wrap
  }
  ignoreEvent() { return false }
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-wysiwyg-hr'
    return hr
  }
  ignoreEvent() { return false }
}

class ListBulletWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }
  toDOM() {
    const span = document.createElement('span')
    span.textContent = /^\d+\./.test(this.text) ? this.text.replace(/\./, '.') + ' ' : '• '
    span.className = 'cm-wysiwyg-list-mark'
    return span
  }
  ignoreEvent() { return false }
}

// Heading font size map
const headingStyles = {
  ATXHeading1: { fontSize: '1.6em', fontWeight: '700', lineHeight: '1.3' },
  ATXHeading2: { fontSize: '1.4em', fontWeight: '600', lineHeight: '1.35' },
  ATXHeading3: { fontSize: '1.2em', fontWeight: '600', lineHeight: '1.4' },
  ATXHeading4: { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.45' },
  ATXHeading5: { fontSize: '1em', fontWeight: '600', lineHeight: '1.5' },
  ATXHeading6: { fontSize: '0.9em', fontWeight: '600', lineHeight: '1.5' },
}

function buildDecorations(view) {
  const widgets = []
  const cursor = view.state.selection.main

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const cursorInside = cursor.from >= node.from && cursor.to <= node.to

        switch (node.type.name) {
          // Heading: hide # marks and style the whole line with bigger font
          case 'ATXHeading1': case 'ATXHeading2': case 'ATXHeading3':
          case 'ATXHeading4': case 'ATXHeading5': case 'ATXHeading6': {
            const level = node.type.name
            const style = headingStyles[level]
            const line = view.state.doc.lineAt(node.from)
            widgets.push({
              from: line.from,
              to: line.from,
              deco: Decoration.line({
                class: `cm-wysiwyg-heading cm-wysiwyg-${level}`,
                attributes: {
                  style: `font-size:${style.fontSize};font-weight:${style.fontWeight};line-height:${style.lineHeight}`,
                },
              })
            })
            break
          }

          case 'HeaderMark': {
            if (!cursorInside) {
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
            }
            break
          }

          case 'EmphasisMark': {
            if (!cursorInside) {
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
              const parent = node.node.parent
              if (parent && node.from === parent.from) {
                const isStrong = parent.type.name === 'StrongEmphasis'
                const contentFrom = node.to
                const contentTo = parent.lastChild ? parent.lastChild.node.from : parent.to
                if (contentTo > contentFrom) {
                  const style = isStrong ? 'font-weight:700' : 'font-style:italic'
                  widgets.push({
                    from: contentFrom,
                    to: contentTo,
                    deco: Decoration.mark({
                      attributes: { style },
                    })
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
                widgets.push({ from: node.from, to: node.from + 1, deco: Decoration.replace({}) })
                widgets.push({ from: node.to - 1, to: node.to, deco: Decoration.replace({}) })
                widgets.push({
                  from: node.from + 1,
                  to: node.to - 1,
                  deco: Decoration.mark({
                    attributes: {
                      style: 'background-color:var(--preview-code-bg);padding:0.15em 0.4em;border-radius:3px;font-family:var(--editor-font-family);font-size:0.9em',
                    },
                  })
                })
              }
            }
            break
          }

          case 'FencedCode': {
            const lineFrom = view.state.doc.lineAt(node.from).from
            let pos = lineFrom
            while (pos <= node.to) {
              const line = view.state.doc.lineAt(pos)
              widgets.push({
                from: line.from,
                to: line.from,
                deco: Decoration.line({
                  class: 'cm-wysiwyg-code-block',
                  attributes: {
                    style: 'background-color:var(--preview-code-bg);font-family:var(--editor-font-family);font-size:0.9em;line-height:1.5;padding-left:16px',
                  },
                })
              })
              pos = line.to + 1
              if (pos > view.state.doc.length) break
            }
            break
          }

          case 'CodeMark': {
            if (!cursorInside) {
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
            }
            break
          }

          case 'CodeInfo': {
            if (!cursorInside) {
              widgets.push({
                from: node.from,
                to: node.to,
                deco: Decoration.mark({
                  attributes: { style: 'opacity:0.5;font-size:0.85em' },
                })
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
                widgets.push({ from: node.from, to: linkTextStart, deco: Decoration.replace({}) })
                widgets.push({ from: linkTextEnd, to: node.to, deco: Decoration.replace({}) })
                widgets.push({
                  from: linkTextStart,
                  to: linkTextEnd,
                  deco: Decoration.mark({
                    attributes: {
                      style: 'color:var(--preview-link);text-decoration:underline',
                      title: match[2],
                    },
                  })
                })
              }
            }
            break
          }

          case 'Image': {
            if (!cursorInside) {
              const text = view.state.doc.sliceString(node.from, node.to)
              const match = text.match(/^!\[([^\]]*)\]\(([^)]*)\)$/)
              if (match) {
                widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ImageWidget(match[2], match[1]) }) })
              }
            }
            break
          }

          case 'QuoteMark': {
            if (!cursorInside) {
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
            }
            break
          }

          // Blockquote: style each line
          case 'Blockquote': {
            const lineFrom = view.state.doc.lineAt(node.from).from
            let pos = lineFrom
            while (pos <= node.to) {
              const line = view.state.doc.lineAt(pos)
              widgets.push({
                from: line.from,
                to: line.from,
                deco: Decoration.line({
                  attributes: {
                    style: 'color:var(--preview-blockquote-fg);padding-left:16px;border-left:3px solid var(--preview-blockquote-border)',
                  },
                })
              })
              pos = line.to + 1
              if (pos > view.state.doc.length) break
            }
            break
          }

          case 'HorizontalRule': {
            if (!cursorInside) {
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new HrWidget(), block: true }) })
            }
            break
          }

          case 'ListMark': {
            if (!cursorInside) {
              const markText = view.state.doc.sliceString(node.from, node.to)
              widgets.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ListBulletWidget(markText) }) })
            }
            break
          }
        }
      },
    })
  }

  // Sort by position - RangeSetBuilder requires strictly ascending order
  widgets.sort((a, b) => a.from - b.from || a.to - b.to)

  const builder = new RangeSetBuilder()
  for (const w of widgets) {
    try {
      builder.add(w.from, w.to, w.deco)
    } catch (e) {
      // Skip overlapping/invalid ranges
    }
  }

  return builder.finish()
}

export const wysiwygPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildDecorations(view)
  }
  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view)
    }
  }
}, {
  decorations: (v) => v.decorations,
})

// Use EditorView.theme with high specificity, not baseTheme which gets overridden by oneDark
export const wysiwygTheme = EditorView.theme({
  '.cm-wysiwyg-code-block': {},
  '.cm-wysiwyg-image img': { maxWidth: '100%', borderRadius: '4px' },
  '.cm-wysiwyg-hr': { border: 'none', borderTop: '1px solid var(--toolbar-border)', margin: '0.5em 0' },
  '.cm-wysiwyg-list-mark': { color: 'var(--editor-fg)', opacity: '0.5' },
})