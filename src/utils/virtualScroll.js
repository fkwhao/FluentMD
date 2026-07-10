export function computeVisibleBlocks(blocks, scrollTop, viewportHeight, overscan = 3) {
  let offsetY = 0
  let startIndex = -1
  let endIndex = blocks.length - 1
  let totalHeight = 0

  // First pass: compute total height of all blocks
  for (let i = 0; i < blocks.length; i++) {
    totalHeight += blocks[i].measuredHeight || blocks[i].estimatedHeight
  }

  // Second pass: determine visible range
  for (let i = 0; i < blocks.length; i++) {
    const height = blocks[i].measuredHeight || blocks[i].estimatedHeight
    const top = offsetY
    const bottom = offsetY + height

    if (bottom > scrollTop - overscan * 50 && startIndex === -1) {
      startIndex = Math.max(0, i - overscan)
    }

    if (top > scrollTop + viewportHeight + overscan * 50) {
      endIndex = Math.min(blocks.length - 1, i + overscan)
      break
    }

    offsetY += height
  }

  if (startIndex === -1) startIndex = 0

  return { startIndex, endIndex, totalHeight }
}

export function getBlockOffset(blocks, index) {
  let offset = 0
  for (let i = 0; i < index && i < blocks.length; i++) {
    offset += blocks[i].measuredHeight || blocks[i].estimatedHeight
  }
  return offset
}
