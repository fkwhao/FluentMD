function wrapSelection(view, before, after) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const beforeLen = before.length
  const afterLen = after.length
  const textBefore = from >= beforeLen ? view.state.sliceDoc(from - beforeLen, from) : ''
  const textAfter = view.state.sliceDoc(to, to + afterLen)
  const docLength = view.state.doc.length

  if (selected.length > 0) {
    if (from >= beforeLen && to + afterLen <= docLength && textBefore === before && textAfter === after) {
      view.dispatch({
        changes: [
          { from: to, to: to + afterLen, insert: '' },
          { from: from - beforeLen, to: from, insert: '' },
        ],
        selection: { anchor: from - beforeLen, head: to - beforeLen },
      })
      return true
    }

    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + beforeLen, head: to + beforeLen },
    })
    return true
  }

  if (textBefore === before && textAfter === after) {
    view.dispatch({
      changes: [
        { from: to, to: to + afterLen, insert: '' },
        { from: from - beforeLen, to: from, insert: '' },
      ],
      selection: { anchor: from - beforeLen },
    })
    return true
  }

  view.dispatch({
    changes: { from, to, insert: before + after },
    selection: { anchor: from + beforeLen },
  })
  return true
}

function getBlockPrefix(text) {
  const match = text.match(/^(\s*(?:>\s)?(?:#{1,6}\s|[-*+]\s|\d+\.\s)?)/)
  return match ? match[1] : ''
}

function getSelectedLines(view) {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1))
  const lines = []

  for (let i = startLine.number; i <= endLine.number; i++) {
    lines.push(view.state.doc.line(i))
  }

  return lines
}

function toggleInlineAcrossLines(view, before, after) {
  const { from, to } = view.state.selection.main
  if (from === to) return wrapSelection(view, before, after)

  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1))

  if (startLine.number === endLine.number) {
    return wrapSelection(view, before, after)
  }

  if (from !== startLine.from || to !== endLine.to) {
    return wrapSelection(view, before, after)
  }

  const lines = getSelectedLines(view)
  const eligibleLines = lines.filter((line) => line.text.trim())

  if (!eligibleLines.length) return true

  const allWrapped = eligibleLines.every((line) => {
    const prefix = getBlockPrefix(line.text)
    const content = line.text.slice(prefix.length)
    return content.startsWith(before) && content.endsWith(after)
  })

  const changes = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.text.trim()) continue

    const prefix = getBlockPrefix(line.text)
    const content = line.text.slice(prefix.length)
    const contentFrom = line.from + prefix.length
    const contentTo = line.to

    if (allWrapped) {
      if (content.startsWith(before) && content.endsWith(after)) {
        changes.push(
          { from: contentTo - after.length, to: contentTo, insert: '' },
          { from: contentFrom, to: contentFrom + before.length, insert: '' },
        )
      }
    } else {
      changes.push(
        { from: contentTo, to: contentTo, insert: after },
        { from: contentFrom, to: contentFrom, insert: before },
      )
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  return true
}

function getLineStart(view, pos) {
  const line = view.state.doc.lineAt(pos)
  return line.from
}

function getLineEnd(view, pos) {
  const line = view.state.doc.lineAt(pos)
  return line.to
}

function getLineText(view, pos) {
  const line = view.state.doc.lineAt(pos)
  return view.state.sliceDoc(line.from, line.to)
}

function setLinePrefix(view, pos, prefix, toggle) {
  const line = view.state.doc.lineAt(pos)
  const text = view.state.sliceDoc(line.from, line.to)
  const currentPrefix = text.match(/^(\s*)(#{1,6}\s|>\s|- |\d+\.\s)/)

  if (currentPrefix && currentPrefix[0].trimStart().startsWith(prefix.trim())) {
    if (toggle) {
      // Remove prefix
      view.dispatch({
        changes: { from: line.from, to: line.from + currentPrefix[0].length, insert: currentPrefix[1] },
        selection: { anchor: pos - currentPrefix[0].length + currentPrefix[1].length },
      })
    }
    return true
  }

  // Replace existing prefix or add new one
  const removeLen = currentPrefix ? currentPrefix[0].length : 0
  view.dispatch({
    changes: { from: line.from, to: line.from + removeLen, insert: prefix },
    selection: { anchor: pos + prefix.length - removeLen },
  })
  return true
}

export function toggleBold(view) {
  return toggleInlineAcrossLines(view, '**', '**')
}

export function toggleItalic(view) {
  return toggleInlineAcrossLines(view, '*', '*')
}

export function toggleStrikethrough(view) {
  return toggleInlineAcrossLines(view, '~~', '~~')
}

export function toggleInlineCode(view) {
  return toggleInlineAcrossLines(view, '`', '`')
}

export function toggleLink(view) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  if (selected.length === 0) {
    view.dispatch({
      changes: { from, to, insert: '[链接文字](url)' },
      selection: { anchor: from + 1, head: from + 5 },
    })
  } else {
    const textBefore = view.state.sliceDoc(from - 1, from)
    const textAfter = view.state.sliceDoc(to, to + 1)
    if (textBefore === '[') {
      // Already a link text, unwrap
      const urlEnd = view.state.sliceDoc(to, to + 50).indexOf(')')
      if (urlEnd !== -1) {
        view.dispatch({
          changes: [
            { from: from - 1, to: from, insert: '' },
            { from: to, to: to + urlEnd + 1, insert: '' },
          ],
        })
      }
    } else {
      view.dispatch({
        changes: { from, to, insert: `[${selected}](url)` },
        selection: { anchor: to + 3, head: to + 6 },
      })
    }
  }
  return true
}

export function insertImage(view) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const alt = selected || '图片描述'
  view.dispatch({
    changes: { from, to, insert: `![${alt}](url)` },
    selection: { anchor: from + alt.length + 4, head: from + alt.length + 7 },
  })
  return true
}

export function toggleHeading(view, level) {
  const { from, to, head } = view.state.selection.main
  const hasSelection = from !== to

  if (hasSelection) {
    const rawSelectedText = view.state.sliceDoc(from, to)
    const selectedText = rawSelectedText.trim()
    if (!selectedText) return true

    const prefix = '#'.repeat(level) + ' '

    // Check if selected text already has heading prefix
    const headingMatch = selectedText.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const currentLevel = headingMatch[1].length
      if (currentLevel === level) {
        // Remove heading markup
        const newText = headingMatch[2]
        view.dispatch({
          changes: { from, to, insert: newText },
          selection: { anchor: from, head: from + newText.length },
        })
      } else {
        // Change heading level
        const newPrefix = '#'.repeat(level) + ' '
        const newText = newPrefix + headingMatch[2]
        view.dispatch({
          changes: { from, to, insert: newText },
          selection: { anchor: from, head: from + newText.length },
        })
      }
      return true
    }

    const line = view.state.doc.lineAt(from)
    const beforeText = view.state.sliceDoc(line.from, from)
    const afterText = view.state.sliceDoc(to, line.to)

    if (!beforeText.trim() && !afterText.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: prefix + selectedText },
        selection: { anchor: line.from + prefix.length, head: line.from + prefix.length + selectedText.length },
      })
      return true
    }

    if (!beforeText.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: prefix + selectedText + afterText },
        selection: { anchor: line.from + prefix.length, head: line.from + prefix.length + selectedText.length },
      })
      return true
    }

    const leadingText = beforeText.replace(/\s+$/, '')
    const headingText = prefix + selectedText + afterText
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${leadingText}\n${headingText}` },
      selection: {
        anchor: line.from + leadingText.length + 1 + prefix.length,
        head: line.from + leadingText.length + 1 + prefix.length + selectedText.length,
      },
    })
    return true
  }

  // No selection - operate on current line
  const pos = head
  const line = view.state.doc.lineAt(pos)
  const text = view.state.sliceDoc(line.from, line.to)
  const match = text.match(/^(#{1,6})\s/)

  if (match) {
    const currentLevel = match[1].length
    if (currentLevel === level) {
      // Remove heading
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: '' },
      })
    } else {
      // Change heading level
      const newPrefix = '#'.repeat(level) + ' '
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: newPrefix },
      })
    }
  } else {
    const prefix = '#'.repeat(level) + ' '
    const changes = [{ from: line.from, to: line.from, insert: prefix }]

    // Ensure blank line before heading
    if (line.number > 1) {
      const prevLine = view.state.doc.line(line.number - 1)
      if (prevLine.text.trim() !== '') {
        changes.unshift({ from: line.from, to: line.from, insert: '\n' })
      }
    }

    // Ensure blank line after heading
    if (line.number < view.state.doc.lines) {
      const nextLine = view.state.doc.line(line.number + 1)
      if (nextLine.text.trim() !== '') {
        changes.push({ from: line.to, to: line.to, insert: '\n' })
      }
    }

    view.dispatch({ changes })
  }
  return true
}

export function toggleBlockquote(view) {
  const pos = view.state.selection.main.head
  return setLinePrefix(view, pos, '> ', true)
}

export function toggleUnorderedList(view) {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1))

  // Check if all selected lines already have unordered list prefix
  let allUL = true
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = view.state.doc.line(i)
    if (line.text.trim() && !/^\s*- /.test(line.text)) { allUL = false; break }
  }

  const changes = []
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = view.state.doc.line(i)
    const match = line.text.match(/^(\s*)(#{1,6}\s|>\s|- |\d+\.\s)/)
    if (allUL) {
      // Remove list prefix
      if (/^\s*- /.test(line.text)) {
        const ulMatch = line.text.match(/^(\s*)- /)
        changes.push({ from: line.from + ulMatch[1].length, to: line.from + ulMatch[1].length + 2, insert: '' })
      }
    } else if (match) {
      // Replace existing prefix
      changes.push({ from: line.from, to: line.from + match[0].length, insert: match[1] + '- ' })
    } else {
      changes.push({ from: line.from, to: line.from, insert: '- ' })
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  return true
}

export function toggleOrderedList(view) {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(Math.max(from, to - 1))

  // Check if all selected lines already have ordered list prefix
  let allOL = true
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = view.state.doc.line(i)
    if (line.text.trim() && !/^\s*\d+\.\s/.test(line.text)) { allOL = false; break }
  }

  const changes = []
  let num = 1
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = view.state.doc.line(i)
    const match = line.text.match(/^(\s*)(#{1,6}\s|>\s|- |\d+\.\s)/)
    if (allOL) {
      // Remove list prefix
      if (/^\s*\d+\.\s/.test(line.text)) {
        const olMatch = line.text.match(/^(\s*)\d+\.\s/)
        changes.push({ from: line.from + olMatch[1].length, to: line.from + olMatch[1].length + olMatch[0].length - olMatch[1].length, insert: '' })
      }
    } else if (match) {
      // Replace existing prefix
      changes.push({ from: line.from, to: line.from + match[0].length, insert: match[1] + num + '. ' })
      num++
    } else {
      changes.push({ from: line.from, to: line.from, insert: num + '. ' })
      num++
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  return true
}

export function insertCodeBlock(view) {
  const pos = view.state.selection.main.head
  const lineEnd = getLineEnd(view, pos)
  view.dispatch({
    changes: { from: lineEnd, to: lineEnd, insert: '\n```\n\n```' },
    selection: { anchor: lineEnd + 5 },
  })
  return true
}

export function insertHorizontalRule(view) {
  const pos = view.state.selection.main.head
  const lineEnd = getLineEnd(view, pos)
  view.dispatch({
    changes: { from: lineEnd, to: lineEnd, insert: '\n\n---\n' },
    selection: { anchor: lineEnd + 6 },
  })
  return true
}

// Detection helpers for menu state
export function isFormatActive(view, format) {
  const { from, to } = view.state.selection.main
  if (from === to && format !== 'heading') return false

  const selectedLines = from === to ? [] : getSelectedLines(view)
  const multiLineFullSelection =
    selectedLines.length > 1 &&
    from === view.state.doc.lineAt(from).from &&
    to === view.state.doc.lineAt(Math.max(from, to - 1)).to

  function isWrappedOnSelectedLines(before, after) {
    const eligibleLines = selectedLines.filter((line) => line.text.trim())
    if (!eligibleLines.length) return false
    return eligibleLines.every((line) => {
      const prefix = getBlockPrefix(line.text)
      const content = line.text.slice(prefix.length)
      return content.startsWith(before) && content.endsWith(after)
    })
  }

  switch (format) {
    case 'bold': {
      if (multiLineFullSelection) return isWrappedOnSelectedLines('**', '**')
      const before = view.state.sliceDoc(from - 2, from)
      const after = view.state.sliceDoc(to, to + 2)
      return before === '**' && after === '**'
    }
    case 'italic': {
      if (multiLineFullSelection) return isWrappedOnSelectedLines('*', '*')
      const before = view.state.sliceDoc(from - 1, from)
      const after = view.state.sliceDoc(to, to + 1)
      return before === '*' && after === '*' && (from < 2 || view.state.sliceDoc(from - 2, from) !== '**')
    }
    case 'strikethrough': {
      if (multiLineFullSelection) return isWrappedOnSelectedLines('~~', '~~')
      const before = view.state.sliceDoc(from - 2, from)
      const after = view.state.sliceDoc(to, to + 2)
      return before === '~~' && after === '~~'
    }
    case 'code': {
      if (multiLineFullSelection) return isWrappedOnSelectedLines('`', '`')
      const before = view.state.sliceDoc(from - 1, from)
      const after = view.state.sliceDoc(to, to + 1)
      return before === '`' && after === '`'
    }
    case 'heading': {
      const pos = from
      const line = view.state.doc.lineAt(pos)
      const text = view.state.sliceDoc(line.from, line.to)
      return /^#{1,6}\s/.test(text)
    }
    case 'blockquote': {
      if (!selectedLines.length) {
        const line = view.state.doc.lineAt(from)
        return view.state.sliceDoc(line.from, line.to).startsWith('>')
      }
      return selectedLines
        .filter((line) => line.text.trim())
        .every((line) => /^(\s*)>\s/.test(line.text))
    }
    case 'ul': {
      if (!selectedLines.length) {
        const line = view.state.doc.lineAt(from)
        return /^[\s]*- /.test(view.state.sliceDoc(line.from, line.to))
      }
      return selectedLines
        .filter((line) => line.text.trim())
        .every((line) => /^\s*- /.test(line.text))
    }
    case 'ol': {
      if (!selectedLines.length) {
        const line = view.state.doc.lineAt(from)
        return /^[\s]*\d+\. /.test(view.state.sliceDoc(line.from, line.to))
      }
      return selectedLines
        .filter((line) => line.text.trim())
        .every((line) => /^\s*\d+\. /.test(line.text))
    }
  }
  return false
}

export function getHeadingLevel(view) {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const text = view.state.sliceDoc(line.from, line.to)
  const match = text.match(/^(#{1,6})\s/)
  return match ? match[1].length : 0
}
