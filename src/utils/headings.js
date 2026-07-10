function cleanHeadingText(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([\\`*_[\]{}()#+.!~>-])/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
}

export function extractHeadings(markdown) {
  const lines = markdown.split('\n')
  const headings = []
  let offset = 0
  let fence = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)

    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const length = fenceMatch[1].length
      if (!fence) fence = { marker, length }
      else if (fence.marker === marker && length >= fence.length) fence = null
      offset += line.length + (index < lines.length - 1 ? 1 : 0)
      continue
    }

    if (!fence) {
      const atx = line.match(/^\s{0,3}(#{1,6})[\t ]+(.+?)\s*#*\s*$/)
      if (atx) {
        const text = cleanHeadingText(atx[2])
        if (text) {
          headings.push({
            level: atx[1].length,
            text,
            pos: offset,
            target: offset + line.indexOf(atx[2]),
          })
        }
      } else if (line.trim() && index + 1 < lines.length) {
        const setext = lines[index + 1].match(/^\s{0,3}(=+|-+)\s*$/)
        if (setext) {
          const text = cleanHeadingText(line)
          if (text) headings.push({ level: setext[1][0] === '=' ? 1 : 2, text, pos: offset, target: offset })
        }
      }
    }

    offset += line.length + (index < lines.length - 1 ? 1 : 0)
  }

  return headings
}
