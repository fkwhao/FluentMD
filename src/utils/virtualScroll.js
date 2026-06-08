export function computeVisibleBlocks(blocks, scrollTop, viewportHeight, overscan = 3) {
  let offsetY = 0
  let startIndex = -1
  let endIndex = blocks.length - 1

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

  return { startIndex, endIndex, totalHeight: offsetY }
}

export function getBlockOffset(blocks, index) {
  let offset = 0
  for (let i = 0; i < index && i < blocks.length; i++) {
    offset += blocks[i].measuredHeight || blocks[i].estimatedHeight
  }
  return offset
}
