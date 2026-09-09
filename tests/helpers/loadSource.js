import { readFile } from 'node:fs/promises'

// Load the real composable with only its external I/O/lifecycle dependencies
// replaced. No production source or files on disk are modified by the harness.
export async function loadSource(path, overrides = {}) {
  const url = new URL(`../../${path}`, import.meta.url)
  const key = `__fluentmd_test_${crypto.randomUUID()}`
  globalThis[key] = overrides
  const source = (await readFile(url, 'utf8')).replace(
    /(from\s+)(['"])([^'"]+)\2/g,
    (match, prefix, quote, specifier) => {
      let resolved
      if (overrides[specifier]) {
        const exports = Object.keys(overrides[specifier]).join(', ')
        const stub = `export const { ${exports} } = globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}]`
        resolved = `data:text/javascript;base64,${Buffer.from(stub).toString('base64')}`
      } else if (specifier.startsWith('@/')) {
        resolved = new URL(`../../src/${specifier.slice(2)}.js`, import.meta.url).href
      } else if (specifier.startsWith('.')) {
        resolved = new URL(specifier, url).href
      } else {
        resolved = import.meta.resolve(specifier)
      }
      return `${prefix}${quote}${resolved}${quote}`
    },
  )
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// ${key}`).toString('base64')}`)
  } finally {
    delete globalThis[key]
  }
}

export function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
