import test from 'node:test'
import assert from 'node:assert/strict'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import * as mathExtension from '../src/utils/mathExtension.js'

const { findMathDecorations } = mathExtension

function decorationsFor(doc, cursorPos = 0) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  })

  return findMathDecorations(
    { state, visibleRanges: [{ from: 0, to: doc.length }] },
    { from: cursorPos, to: cursorPos },
  )
}

function widgetsOfKind(decorations, kind) {
  return decorations.filter((decoration) => decoration.widget?.constructor?.name === kind)
}

test('renders display math after a blockquote prefix', () => {
  const doc = '> $$x \\neq y$$'
  const widgets = widgetsOfKind(decorationsFor(doc), 'BlockMathWidget')

  assert.equal(widgets.length, 1)
  assert.equal(doc.slice(widgets[0].from, widgets[0].to), '$$x \\neq y$$')
  assert.equal(widgets[0].widget.tex, 'x \\neq y')
})

test('renders display math when the cursor is at its closing boundary', () => {
  const doc = '$$x + y$$'
  const widgets = widgetsOfKind(decorationsFor(doc, doc.length), 'BlockMathWidget')

  assert.equal(widgets.length, 1)
})

test('reveals display math source when the cursor is inside its content', () => {
  const doc = '$$x + y$$'
  const widgets = widgetsOfKind(decorationsFor(doc, doc.indexOf('x')), 'BlockMathWidget')

  assert.equal(widgets.length, 0)
})

test('renders inline math nested inside strong emphasis', () => {
  const widgets = widgetsOfKind(decorationsFor('**$O(n)$**'), 'InlineMathWidget')

  assert.equal(widgets.length, 1)
  assert.equal(widgets[0].widget.tex, 'O(n)')
})

test('renders an indented display formula without replacing its indentation', () => {
  const doc = '  $$index = (n - 1) \\& hash$$'
  const widgets = widgetsOfKind(decorationsFor(doc), 'BlockMathWidget')

  assert.equal(widgets.length, 1)
  assert.equal(doc.slice(widgets[0].from, widgets[0].to), '$$index = (n - 1) \\& hash$$')
})

test('renders multiline display math inside a blockquote', () => {
  const doc = ['> $$', '> x \\neq y', '> $$'].join('\n')
  const widgets = widgetsOfKind(decorationsFor(doc), 'BlockMathWidget')

  assert.equal(widgets.length, 1)
  assert.equal(widgets[0].widget.tex, 'x \\neq y')
})

test('does not render math-looking text inside code', () => {
  const inlineCode = widgetsOfKind(decorationsFor('`$O(n)$`'), 'InlineMathWidget')
  const fencedCode = widgetsOfKind(
    decorationsFor(['```text', '$$x + y$$', '```'].join('\n')),
    'BlockMathWidget',
  )

  assert.equal(inlineCode.length, 0)
  assert.equal(fencedCode.length, 0)
})

test('removes text decorations that overlap a math replacement range', () => {
  assert.equal(typeof mathExtension.removeOverlappingDecorations, 'function')

  const openingMark = { from: 0, to: 2, kind: 'opening-mark' }
  const strongContent = { from: 2, to: 8, kind: 'strong-content' }
  const closingMark = { from: 8, to: 10, kind: 'closing-mark' }
  const lineDecoration = { from: 2, to: 2, kind: 'line' }
  const decorations = [openingMark, strongContent, closingMark, lineDecoration]

  const removed = mathExtension.removeOverlappingDecorations(decorations, 2, 8)

  assert.equal(removed, 1)
  assert.deepEqual(decorations, [openingMark, closingMark, lineDecoration])
})
