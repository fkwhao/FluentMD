import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Tauri always builds fresh frontend assets and starts Vite for development', async () => {
  const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  assert.equal(config.build.beforeBuildCommand, 'npm run build')
  assert.equal(config.build.beforeDevCommand, 'npm run dev')
  assert.equal(config.build.frontendDist, '../dist')
})
