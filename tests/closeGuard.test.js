import test from 'node:test'
import assert from 'node:assert/strict'
import { createCloseGuard } from '../src/utils/closeGuard.js'
import { deferred } from './helpers/loadSource.js'

function setup(overrides = {}) {
  const log = []
  const state = { documentId: 1, content: 'unsaved text', dirty: true }
  const handler = createCloseGuard({
    isDirty: () => state.dirty,
    snapshot: () => ({ documentId: state.documentId, content: state.content }),
    save: async () => { state.dirty = false; log.push('save'); return true },
    waitForPendingSaves: async () => {},
    choose: async () => 'cancel',
    close: async () => { log.push('close') },
    reportError: () => { log.push('error') },
    ...overrides,
  })
  const close = () => handler({ preventDefault() { log.push('prevent') } })
  return { close, state, log }
}

test('cancel leaves unsaved content open', async () => {
  const { close, log } = setup()
  await close()
  assert.deepEqual(log, ['prevent'])
})

test('save completes before the window closes', async () => {
  const { close, log } = setup({ choose: async () => 'save' })
  await close()
  assert.deepEqual(log, ['prevent', 'save', 'close'])
})

test('save failure or a cancelled Save As dialog never closes the window', async () => {
  const { close, log } = setup({ choose: async () => 'save', save: async () => false })
  await close()
  assert.deepEqual(log, ['prevent'])
})

test('explicit discard closes without writing', async () => {
  const { close, log } = setup({ choose: async () => 'discard' })
  await close()
  assert.deepEqual(log, ['prevent', 'close'])
})

test('changes made while the exit prompt is open are not discarded', async () => {
  const prompt = deferred()
  const { close, state, log } = setup({ choose: () => prompt.promise })
  const closing = close()
  await Promise.resolve()
  state.content = 'newer text'
  prompt.resolve('discard')
  await closing
  assert.deepEqual(log, ['prevent'])
})

test('repeated close requests show only one prompt', async () => {
  const prompt = deferred()
  let prompts = 0
  const { close } = setup({ choose: () => { prompts++; return prompt.promise } })
  const first = close()
  const second = close()
  await Promise.resolve()
  assert.equal(prompts, 1)
  prompt.resolve('cancel')
  await Promise.all([first, second])
})

test('exit waits for in-flight writes before deciding whether the document is clean', async () => {
  const writing = deferred()
  const { close, state, log } = setup({ waitForPendingSaves: () => writing.promise })
  const closing = close()
  assert.deepEqual(log, ['prevent'])
  state.dirty = false
  writing.resolve()
  await closing
  assert.deepEqual(log, ['prevent', 'close'])
})

test('edits made during the final save keep the window open', async () => {
  const { close, log } = setup({ choose: async () => 'save', save: async () => true })
  await close()
  assert.deepEqual(log, ['prevent'])
})
