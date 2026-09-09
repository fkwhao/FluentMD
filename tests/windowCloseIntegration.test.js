import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the app installs close protection and permits its guarded native close', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /useWindowCloseGuard\(\)/)
  const capability = JSON.parse(await readFile(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'))
  assert.ok(capability.permissions.includes('core:window:allow-destroy'))
})
