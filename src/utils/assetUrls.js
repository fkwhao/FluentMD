import { convertFileSrc } from '@tauri-apps/api/core'

const REMOTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]|^\\\\/

function isRemoteOrSpecialSrc(src) {
  return (
    src.startsWith('file:') ||
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('mailto:') ||
    src.startsWith('tel:') ||
    src.startsWith('//') ||
    (REMOTE_URL_RE.test(src) && !WINDOWS_ABSOLUTE_RE.test(src))
  )
}

function isWindowsPath(path) {
  return WINDOWS_ABSOLUTE_RE.test(path)
}

function normalizeSeparators(path, useWindowsSeparators) {
  return useWindowsSeparators ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/')
}

function joinPath(baseDir, relativePath, useWindowsSeparators) {
  const separator = useWindowsSeparators ? '\\' : '/'
  const baseParts = normalizeSeparators(baseDir, useWindowsSeparators).split(separator)
  const relativeParts = normalizeSeparators(relativePath, useWindowsSeparators).split(separator)
  const resolvedParts = []

  for (const part of baseParts) {
    if (!part) continue
    resolvedParts.push(part)
  }

  for (const part of relativeParts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (resolvedParts.length > 1) {
        resolvedParts.pop()
      }
      continue
    }
    resolvedParts.push(part)
  }

  if (!resolvedParts.length) {
    return relativePath
  }

  const joined = resolvedParts.join(separator)
  if (useWindowsSeparators) return joined
  return joined.startsWith('/') ? joined : `/${joined}`
}

function resolveFilePath(src, basePath = '') {
  if (!src) return src
  if (src.startsWith('file:')) {
    try {
      const url = new URL(src)
      return decodeURIComponent(url.pathname)
    } catch {
      return src.replace(/^file:\/+/, '/')
    }
  }
  if (isRemoteOrSpecialSrc(src)) return src

  const useWindowsSeparators = isWindowsPath(src) || isWindowsPath(basePath)
  if (isWindowsPath(src) || src.startsWith('/')) {
    return normalizeSeparators(src, useWindowsSeparators)
  }

  if (!basePath) {
    return normalizeSeparators(src, useWindowsSeparators)
  }

  const baseDir = basePath.replace(/[\\/][^\\/]*$/, '')
  return joinPath(baseDir, src, useWindowsSeparators)
}

export function resolveMarkdownAssetSrc(src, basePath = '') {
  let filePath = resolveFilePath(src, basePath)
  if (!filePath || isRemoteOrSpecialSrc(filePath)) return filePath

  // Normalize backslashes to forward slashes for cross-platform compatibility
  filePath = filePath.replace(/\\/g, '/')

  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.convertFileSrc) {
    try {
      return convertFileSrc(filePath)
    } catch {
      return filePath
    }
  }

  // Fallback for non-Tauri: convert Windows absolute paths to file:/// URLs
  if (/^[a-zA-Z]:[\\/]/.test(filePath)) {
    return 'file:///' + filePath
  }

  return filePath
}
