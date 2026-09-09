import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '../src/stores/editor.js'
import { useFileStore } from '../src/stores/file.js'
import { loadSource, deferred } from './helpers/loadSource.js'

async function setup(io = {}) {
  setActivePinia(createPinia())
  globalThis.confirm = () => true
  globalThis.window = { alert() {} }
  const { useFileOperations } = await loadSource('src/composables/useFileOperations.js', {
    '@tauri-apps/plugin-fs': { readTextFile: async () => 'opened', writeTextFile: async () => {}, ...io },
    '@tauri-apps/plugin-dialog': { open: async () => null, save: async () => null, ...io },
  })
  const editor = useEditorStore()
  const file = useFileStore()
  file.setFile('test.md', 'test.md')
  editor.setContent('version A')
  editor.markDirty()
  return { editor, file, operations: useFileOperations(), useFileOperations }
}

test('typing while a save is pending keeps the newer text dirty', async () => {
  const write = deferred()
  const saved = []
  const { editor, operations } = await setup({ writeTextFile: async (path, text) => { saved.push(text); await write.promise } })
  const saving = operations.saveFile()
  editor.updateContent('version B')
  write.resolve()
  await saving
  assert.deepEqual(saved, ['version A'])
  assert.equal(editor.content, 'version B')
  assert.equal(editor.isDirty, true)
})

test('a normal completed save marks the exact saved document clean', async () => {
  const { editor, operations } = await setup()
  await operations.saveFile()
  assert.equal(editor.isDirty, false)
})

test('typing during an asynchronous open is not silently overwritten', async () => {
  const read = deferred()
  const { editor, operations, file } = await setup({ readTextFile: () => read.promise })
  const opening = operations.openFilePath('other.md')
  editor.updateContent('new unsaved text')
  globalThis.confirm = () => false
  read.resolve('other document')
  await opening
  assert.equal(editor.content, 'new unsaved text')
  assert.equal(file.filePath, 'test.md')
  assert.equal(editor.isDirty, true)
})

test('an older pending open cannot replace a newer file selection', async () => {
  const read = deferred()
  const { editor, operations, file } = await setup({ readTextFile: path => path === 'slow.md' ? read.promise : Promise.resolve('latest file') })
  const opening = operations.openFilePath('slow.md')
  await operations.openFilePath('latest.md')
  read.resolve('stale file')
  await opening
  assert.equal(editor.content, 'latest file')
  assert.equal(file.filePath, 'latest.md')
})

test('writes from different composable instances are serialized', async () => {
  const firstWrite = deferred()
  const saved = []
  const { editor, operations, useFileOperations } = await setup({
    writeTextFile: async (path, text) => { saved.push(text); if (text === 'version A') await firstWrite.promise },
  })
  const first = operations.saveFile()
  editor.updateContent('version B')
  const second = useFileOperations().saveFile()
  await Promise.resolve()
  assert.deepEqual(saved, ['version A'])
  firstWrite.resolve()
  await Promise.all([first, second])
  assert.deepEqual(saved, ['version A', 'version B'])
  assert.equal(editor.isDirty, false)
})

test('saving an old document cannot clear the new document dirty flag', async () => {
  const writing = deferred()
  const { editor, operations } = await setup({ writeTextFile: () => writing.promise })
  const saving = operations.saveFile()
  editor.setContent('version A')
  editor.markDirty()
  writing.resolve()
  await saving
  assert.equal(editor.isDirty, true)
})

test('cancelled Save As reports failure and preserves unsaved state', async () => {
  const { editor, operations } = await setup()
  assert.equal(await operations.saveFileAs(), false)
  assert.equal(editor.isDirty, true)
})

test('Save As snapshots do not mark edits made during the picker as saved', async () => {
  const picker = deferred()
  const saved = []
  const { editor, file, operations } = await setup({ save: () => picker.promise, writeTextFile: async (path, text) => saved.push(text) })
  const saving = operations.saveFileAs()
  editor.updateContent('newer content')
  picker.resolve('copy.md')
  assert.equal(await saving, false)
  assert.deepEqual(saved, ['version A'])
  assert.equal(file.filePath, 'copy.md')
  assert.equal(editor.isDirty, true)
})
