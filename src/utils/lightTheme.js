import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#1d1d1f' },
  { tag: tags.heading2, color: '#1d1d1f' },
  { tag: tags.heading3, color: '#1d1d1f' },
  { tag: tags.heading4, color: '#1d1d1f' },
  { tag: tags.heading5, color: '#1d1d1f' },
  { tag: tags.heading6, color: '#1d1d1f' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#007aff', textDecoration: 'underline' },
  { tag: tags.url, color: '#007aff', opacity: '0.7' },
  { tag: tags.monospace, color: '#c7254e', backgroundColor: '#f5f5f7' },
  { tag: tags.quote, color: '#6e6e73' },
  { tag: tags.meta, color: '#86868b' },
  { tag: tags.comment, color: '#86868b' },
  { tag: tags.processingInstruction, color: '#86868b' },
  { tag: tags.contentSeparator, color: '#86868b' },
  { tag: tags.list, color: '#86868b' },
])

export const lightTheme = [
  EditorView.theme({
    '&': { backgroundColor: 'var(--editor-bg)', color: 'var(--editor-fg)' },
    '.cm-content': { caretColor: 'var(--editor-cursor)' },
    '.cm-cursor': { borderLeftColor: 'var(--editor-cursor)' },
    '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--editor-selection) !important' },
    '.cm-gutters': { backgroundColor: 'var(--editor-gutter-bg)', color: 'var(--editor-gutter-fg)', borderRight: 'none' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)', color: 'var(--editor-fg)' },
    '.cm-foldGutter': { opacity: '0.4' },
    '.cm-foldGutter:hover': { opacity: '1' },
  }, { dark: false }),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  syntaxHighlighting(lightHighlight),
]
